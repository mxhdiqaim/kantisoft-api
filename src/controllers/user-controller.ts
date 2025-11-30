/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, inArray, ne, or, SQL } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import passport from "passport";

import { generateToken } from "../config/jwt-config";
import db from "../db";
import { InsertUserSchemaT, users } from "../schema/users-schema";
import { handleError2 } from "../service/error-handling";
import { passwordHashService } from "../service/password-hash-service";
import { UserRoleEnum, UserStatusEnum } from "../types/enums";
import { stores } from "../schema/stores-schema";
import { CustomRequest } from "../types/express";
import { logActivity } from "../service/activity-logger";
import { StatusCodes } from "http-status-codes";

/**
 * @desc    Register a new Manager and their first Store
 * @route   POST /api/register
 * @access  Public
 */
export const registerManagerAndStore = async (req: Request, res: Response) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            phone,
            storeName,
            storeType,
        } = req.body;

        // Validate input
        if (!email || !password || !firstName || !storeName || !storeType) {
            return handleError2(
                res,
                "First name, email, password, store name, and store type are required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        // Normalise phone input: Convert empty string or undefined to null
        // This ensures consistent storage (NULL for truly optional/blank) and
        // allows correct SQL NULL handling in uniqueness checks.
        const normalizedPhone =
            phone === "" || phone === undefined ? null : phone;

        // Build the base condition (email is always checked)
        let whereConditions: SQL<unknown> | undefined = eq(users.email, email);

        // If a non-null phone number is provided, combine with the email condition using 'or'
        if (normalizedPhone !== null) {
            whereConditions = or(
                whereConditions,
                eq(users.phone, normalizedPhone),
            );
        }

        // Check for existing user with either the email OR the provided (non-null) phone
        // This check is global, as this controller creates the first manager/store
        const existingUser = await db.query.users.findFirst({
            where: whereConditions,
        });

        if (existingUser) {
            // Provide more specific feedback to the user
            if (existingUser.email === email) {
                return handleError2(
                    res,
                    "A user with this email already exists.",
                    StatusCodes.CONFLICT,
                );
            } else if (
                normalizedPhone !== null &&
                existingUser.phone === normalizedPhone
            ) {
                return handleError2(
                    res,
                    "A user with this phone number already exists.",
                    StatusCodes.CONFLICT,
                );
            } else {
                // Fallback for general case or if both match (less likely with specific checks above)
                return handleError2(
                    res,
                    "A user with this email or phone number already exists.",
                    StatusCodes.CONFLICT,
                );
            }
        }

        // Use a transaction to ensure both user and store are created, or neither.
        const { user, token } = await db.transaction(async (tx) => {
            // Create the store first
            const [newStore] = await tx
                .insert(stores)
                .values({ name: storeName, storeType })
                .returning();

            // Then create the user, assigning them the manager role and linking the new store
            const hashedPassword = await passwordHashService.hash(password);
            const [newUser] = await tx
                .insert(users)
                .values({
                    firstName,
                    lastName,
                    email,
                    password: hashedPassword,
                    phone: normalizedPhone,
                    role: UserRoleEnum.MANAGER, // Automatically a manager
                    status: UserStatusEnum.ACTIVE,
                    storeId: newStore.id, // Link to the new store
                })
                .returning();

            // Generate a token for the new user
            const token = generateToken(newUser);

            return { user: newUser, token };
        });

        // Log activity for manager registration
        await logActivity({
            userId: user.id,
            storeId: String(user.storeId),
            action: "MANAGER_REGISTERED",
            entityId: user.id,
            entityType: "user",
            details: `Manager ${user.firstName} ${user.lastName} registered and created store.`,
        });

        // Return the new user (without password) and the token
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;

        res.status(StatusCodes.CREATED).json({
            user: userWithoutPassword,
            token,
        });
    } catch (error: any) {
        // console.error("Registration Error:", error);
        // CRITICAL FIX: Add more specific error handling for unique constraints.
        // If the database constraint (e.g. users_storeId_phone_unique) is violated,
        // Drizzle might throw an error with a specific code/constraint name.
        if (
            error.cause &&
            typeof error.cause === "object" &&
            "code" in error.cause &&
            error.cause.code === "23505"
        ) {
            if ("constraint" in error.cause) {
                switch (error.cause.constraint) {
                    case "users_email_unique": // If you have a global unique email constraint
                        return handleError2(
                            res,
                            "A user with this email already exists globally.",
                            StatusCodes.CONFLICT,
                            error instanceof Error ? error : undefined,
                        );
                    case "users_storeId_email_unique": // Your storeId, email unique constraint
                        return handleError2(
                            res,
                            "A user with this email already exists within a store.",
                            StatusCodes.CONFLICT,
                            error instanceof Error ? error : undefined,
                        );
                    case "users_storeId_phone_unique": // Your storeId, phone unique constraint
                        return handleError2(
                            res,
                            "A user with this phone number already exists within a store.",
                            StatusCodes.CONFLICT,
                            error instanceof Error ? error : undefined,
                        );
                }
            }
        }
        handleError2(
            res,
            "Registration failed. Please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/v1/users
 * @access  Private Managers | Admins
 *          Managers can see all users in their store, Admins can on only the users in their store
 */
export const getAllUsers = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "Authenticated user is not associated with any store.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Find the main store and its branches
        const mainStore = await db.query.stores.findFirst({
            where: eq(stores.id, storeId),
            with: {
                branches: true,
            },
        });

        if (!mainStore) {
            return handleError2(res, "Store not found.", StatusCodes.NOT_FOUND);
        }

        // Collect the ID of the main store and all its branch IDs
        const storeIds = [
            mainStore.id,
            ...(mainStore.branches?.map((branch) => branch.id) || []),
        ];

        // Fetch all users from the collected store IDs
        const allUsers = await db
            .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
                phone: users.phone,
                role: users.role,
                status: users.status,
                createdAt: users.createdAt,
                lastModified: users.lastModified,
                store: {
                    id: stores.id,
                    name: stores.name,
                    location: stores.location,
                },
            })
            .from(users)
            .leftJoin(stores, eq(users.storeId, stores.id))
            .where(
                and(
                    inArray(users.storeId, storeIds),
                    ne(users.status, UserStatusEnum.DELETED)
                )
            );

        res.status(StatusCodes.OK).json(allUsers);

    } catch (error) {
        // console.error("Error fetching all users:", error);
        return handleError2(
            res,
            "Failed to fetch users.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Get a single user by their ID
 * @route   GET /users/:id
 * @access  Private (Manager, Admin of the same store, or the user themselves)
 */
export const getUserById = async (req: CustomRequest, res: Response) => {
    try {
        const { id: targetUserId } = req.params;
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if(!storeId) {
            return handleError2(
                res,
                "Authenticated user is not associated with any store.",
                StatusCodes.FORBIDDEN,
            )
        }

        // // Check if a user is authenticated
        // if (!currentUser || !userStoreId) {
        //     return handleError2(
        //         res,
        //         "Authentication required.",
        //         StatusCodes.UNAUTHORIZED,
        //     );
        // }


        // Find the current user's store and its hierarchy (parent and branches)
        const userStore = await db.query.stores.findFirst({
            where: eq(stores.id, storeId),
            with: {
                parent: true,
                branches: true,
            },
        });

        if (!userStore) {
            return handleError2(
                res,
                "Associated store not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Collect all relevant store IDs
        const accessibleStoreIds = new Set<string>([storeId]);

        if (userStore.parent) {
            accessibleStoreIds.add(userStore.parent.id);
        }

        userStore.branches?.forEach((branch) => accessibleStoreIds.add(branch.id));


        // Fetch the target user if they are in the accessible store network
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, targetUserId),
                inArray(users.storeId, Array.from(accessibleStoreIds)),
            ),
        });

        if (!targetUser) {
            return handleError2(
                res,
                "User not found or you do not have permission to view this profile.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Authorisation Logic
        const isManager = currentUser.role === UserRoleEnum.MANAGER;
        const isOwnProfile = currentUser.id === targetUser.id;
        const isAdminInSameStore =
            currentUser.role === UserRoleEnum.ADMIN &&
            storeId === targetUser.storeId;

        // Deny access if none of the conditions are met
        if (!isManager && !isOwnProfile && !isAdminInSameStore) {
            return handleError2(
                res,
                "You do not have permission to view this profile.",
                StatusCodes.FORBIDDEN,
            );
        }

        // // Log activity for viewing a user
        // await logActivity({
        //     userId: currentUser.id,
        //     storeId: userStoreId,
        //     action: "USER_VIEWED",
        //     entityId: targetUser.id,
        //     entityType: "user",
        //     details: `User ${targetUser.firstName} ${targetUser.lastName} viewed by ${currentUser.firstName} ${currentUser.lastName}.`,
        // });

        // Return user data without the password
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = targetUser;
        res.status(StatusCodes.OK).json(userWithoutPassword);
    } catch (error) {
        handleError2(
            res,
            "Failed to fetch user.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Soft delete a user by setting their status to 'deleted'
 * @route   DELETE /users/:id
 * @access  Private (Manager or Admin)
 */
export const deleteUser = async (req: CustomRequest, res: Response) => {
    try {
        const { id: targetUserId } = req.params;
        const currentUser = req.user?.data;

        // Check for authentication
        if (!currentUser) {
            return handleError2(
                res,
                "Authentication required.",
                StatusCodes.UNAUTHORIZED,
            );
        }

        // Prevent users from deleting themselves
        if (currentUser.id === targetUserId) {
            return handleError2(
                res,
                "You cannot perform this action",
                StatusCodes.FORBIDDEN,
            );
        }

        // Fetch the user to be deleted, but only if they are in the current user's store.
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, targetUserId),
                eq(users.storeId, String(currentUser.storeId)),
            ),
        });

        if (!targetUser) {
            return handleError2(
                res,
                "User not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Authorisation Logic: Who can delete whom?
        const isManager = currentUser.role === UserRoleEnum.MANAGER;
        const isAdmin = currentUser.role === UserRoleEnum.ADMIN;

        const canDelete =
            // A Manager can delete any user except another Manager
            (isManager && targetUser.role !== UserRoleEnum.MANAGER) ||
            // An Admin can delete Users or Guests in the same store
            (isAdmin &&
                (targetUser.role === UserRoleEnum.USER ||
                    targetUser.role === UserRoleEnum.GUEST) &&
                currentUser.storeId === targetUser.storeId);

        if (!canDelete) {
            return handleError2(
                res,
                "You do not have permission to delete this user.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Perform the soft delete by updating the status
        await db
            .update(users)
            .set({ status: UserStatusEnum.DELETED })
            .where(
                and(
                    eq(users.id, targetUserId),
                    eq(users.storeId, String(currentUser.storeId)), // <-- CRITICAL FIX: Add multi-tenancy filter
                ),
            );

        // Log activity for user deletion
        await logActivity({
            userId: currentUser.id,
            storeId: String(currentUser.storeId),
            action: "USER_DELETED",
            entityId: targetUserId,
            entityType: "user",
            details: `User ${targetUser.firstName} ${targetUser.lastName} deleted by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.OK).json({
            message: "User account has been successfully deleted.",
        });
    } catch (error) {
        // console.error("Error deleting user:", error);
        handleError2(
            res,
            "Failed to delete user.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

export const createUser = async (req: CustomRequest, res: Response) => {
    try {
        const payload = req.body;
        const currentUser = req.user?.data;

        // Check if the user is authenticated
        if (!currentUser) {
            return handleError2(
                res,
                "User not authenticated",
                StatusCodes.FORBIDDEN,
            );
        }

        // Get the storeId from the current user
        const storeId = currentUser.storeId;
        if (!storeId) {
            return handleError2(
                res,
                "User does not belong to a store.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Example of an updated manual check for email uniqueness
        const existingUserByEmail = await db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.email, payload.email),
                    eq(users.storeId, storeId), // Filter by current user's storeId
                ),
            )
            .limit(1);

        if (existingUserByEmail.length > 0) {
            return handleError2(
                res,
                "A user with this email already exists in this store.",
                StatusCodes.CONFLICT,
            );
        }

        // Authorisation: Current user's role vs. target user's role
        const { role: currentRole } = currentUser;
        const { role: targetRole } = payload;

        // Define allowed roles for creation based on the current user's role
        const allowedCreations: { [key: string]: string[] } = {
            [UserRoleEnum.MANAGER]: [
                UserRoleEnum.MANAGER,
                UserRoleEnum.ADMIN,
                UserRoleEnum.USER,
                UserRoleEnum.GUEST,
            ],
            [UserRoleEnum.ADMIN]: [
                UserRoleEnum.ADMIN,
                UserRoleEnum.USER,
                UserRoleEnum.GUEST,
            ],
        };

        // Get the list of roles the current user is allowed to create
        const canCreateRoles = allowedCreations[currentRole] || [];

        if (!canCreateRoles.includes(targetRole)) {
            return handleError2(
                res,
                "You don't have permission to create this user type.",
                StatusCodes.FORBIDDEN,
            );
        }

        const hashedPassword = await passwordHashService.hash(payload.password);

        // *** CRITICAL CHANGE 3: Handle phone number conversion to NULL ***
        const phoneToInsert =
            payload.phone === "" || payload.phone === undefined
                ? null
                : payload.phone;

        // Construct the user object for insertion, explicitly picking fields
        // This prevents unexpected fields from req.body from being inserted
        const newUserToInsert: InsertUserSchemaT = {
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            password: hashedPassword,
            phone: phoneToInsert, // Use the NULL-safe phone value
            role: targetRole, // Use the validated target role
            status: UserStatusEnum.ACTIVE,
            storeId: storeId, // Assign the store ID from the current user
        };

        // CRITICAL FIX: Add the storeId to the values object
        const [newUser] = await db
            .insert(users)
            .values(newUserToInsert)
            .returning();

        // Log the activity
        await logActivity({
            userId: currentUser.id,
            storeId: storeId,
            action: "USER_CREATED",
            entityId: newUser.id,
            entityType: "user",
            details: `User ${newUser.firstName} ${newUser.lastName} (${newUser.role}) created by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = newUser;

        res.status(StatusCodes.CREATED).json(userWithoutPassword);
    } catch (error: any) {
        // console.error(error);
        // *** CRITICAL CHANGE 4: More specific error handling for unique constraints ***
        if (error.cause && error.cause.code === "23505") {
            // PostgreSQL unique violation error code
            if (error.cause.constraint === "users_email_unique") {
                return handleError2(
                    res,
                    "A user with this email already exists.",
                    StatusCodes.CONFLICT,
                );
            }
            if (error.cause.constraint === "users_storeId_phone_unique") {
                // Your new constraint name
                return handleError2(
                    res,
                    "A user with this phone number already exists in this store.",
                    StatusCodes.CONFLICT,
                );
            }
        }
        handleError2(
            res,
            "Problem creating user, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Update a user's profile information
 * @route   PATCH /users/:id
 * @access  Private
 */
export const updateUser = async (req: CustomRequest, res: Response) => {
    try {
        const { id: targetUserId } = req.params;
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const updateData = req.body;

        // Authenticated check
        if (!storeId) {
            return handleError2(
                res,
                "Must belong to a store to perform this action.",
                StatusCodes.UNAUTHORIZED,
            );
        }

        // Get all stores managed by the current user (main store + branches)
        const mainStore = await db.query.stores.findFirst({
            where: eq(stores.id, storeId),
            with: { branches: true },
        });

        if (!mainStore) {
            return handleError2(
                res,
                "Your associated store could not be found.",
                StatusCodes.NOT_FOUND,
            );
        }

        const accessibleStoreIds = [
            mainStore.id,
            ...(mainStore.branches?.map((branch) => branch.id) || []),
        ];

        // Fetch the user to be updated from within the accessible store network
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, targetUserId),
                inArray(users.storeId, accessibleStoreIds),
            ),
        });

        if (!targetUser) {
            return handleError2(
                res,
                "User not found or not within your managed stores.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Sanitise payload - password cannot be updated here
        delete updateData.password;
        delete updateData.id; // Prevent changing the ID

        // Authz Logic
        const isSelfUpdate = currentUser.id === targetUserId;
        const isManager = currentUser.role === UserRoleEnum.MANAGER;
        const isAdmin = currentUser.role === UserRoleEnum.ADMIN;
        let canUpdate = false;

        if (isSelfUpdate) {
            // Users cannot change their own role, store, or status
            delete updateData.role;
            delete updateData.storeId;
            delete updateData.status;
            canUpdate = true;
        } else if (isManager) {
            // Managers can update any user in their store
            canUpdate = true;
        } else if (isAdmin) {
            // Admins can update users (not Managers/Admins) in their store or branches
            if (
                targetUser.role !== UserRoleEnum.MANAGER &&
                targetUser.role !== UserRoleEnum.ADMIN
            ) {
                // Admins cannot change a user's role or store assignment
                delete updateData.role;
                delete updateData.storeId;
                canUpdate = true;
            }
        }

        if (!canUpdate) {
            return handleError2(
                res,
                "You do not have permission to update this user.",
                StatusCodes.FORBIDDEN,
            );
        }

        if (Object.keys(updateData).length === 0) {
            return handleError2(
                res,
                "No valid fields provided for update.",
                StatusCodes.BAD_REQUEST,
            );
        }

        // Perform the update
        if (Object.keys(updateData).length === 0) {
            return handleError2(
                res,
                "No valid fields provided for update.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const { phone } = updateData;

        const phoneToUpdate = phone === "" ? null : phone;

        // Perform the update, ensuring the target is still in an accessible store
        const [updatedUser] = await db
            .update(users)
            .set({ phone: phoneToUpdate, ...updateData, lastModified: new Date() })
            .where(
                and(
                    eq(users.id, targetUserId),
                    inArray(users.storeId, accessibleStoreIds),
                ),
            )
            .returning();

        // Log activity for user update
        await logActivity({
            userId: currentUser.id,
            storeId: String(currentUser.storeId),
            action: "USER_UPDATED",
            entityId: targetUserId,
            entityType: "user",
            details: `User ${targetUser.firstName} ${targetUser.lastName} updated by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        // Return the updated user data (without password)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = updatedUser;
        res.status(StatusCodes.OK).json(userWithoutPassword);
    } catch (error) {
        // console.error("Error updating user:", error);
        handleError2(
            res,
            "Failed to update user.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc        Change a user's store (Manager only)
 * @route       PATCH /api/v1/users/:targetUserId/change-store
 * @access      Private (Manager)
 * @param       id The ID of the user to move.
 * @body        { "newStoreId": "string" }
 */
export const changeUserStore = async (req: CustomRequest, res: Response) => {
    try {
        const { id: targetUserId } = req.params;
        const { newStoreId } = req.body;
        const currentUser = req.user?.data;
        const currentStoreId = currentUser?.storeId;

        if(!currentStoreId) {
            return handleError2(
                res,
                "Authenticated user is not associated with any store.",
                StatusCodes.UNAUTHORIZED,
            )
        }

        if (!newStoreId) {
            return handleError2(
                res,
                "New store ID is required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        if (currentUser.role !== UserRoleEnum.MANAGER) {
            return handleError2(
                res,
                "Only Managers can change user stores.",
                StatusCodes.UNAUTHORIZED
            )
        }

        if (currentStoreId === targetUserId) {
            return handleError2(
                res,
                "Managers cannot change their own store.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Get all stores managed by the current manager
        const mainStore = await db.query.stores.findFirst({
            where: eq(stores.id, String(currentUser.storeId)),
            with: { branches: true },
        });

        if (!mainStore) {
            return handleError2(
                res,
                "Store not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        const managedStoreIds = [
            mainStore.id,
            ...(mainStore.branches?.map((branch) => branch.id) || []),
        ];

        // Validate the new store exists and is managed by the manager
        if (!managedStoreIds.includes(newStoreId)) {
            return handleError2(
                res,
                "New store not found or not managed by you.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Fetch the target user and validate their role and current store
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, targetUserId),
                inArray(users.storeId, managedStoreIds),
            ),
        });

        if (!targetUser) {
            return handleError2(
                res,
                "User not found or not within your managed stores.",
                StatusCodes.NOT_FOUND,
            );
        }

        const allowedRolesToChange = [
            UserRoleEnum.ADMIN,
            UserRoleEnum.USER,
            UserRoleEnum.GUEST,
        ];
        if (!allowedRolesToChange.includes(targetUser.role as UserRoleEnum)) {
            return handleError2(
                res,
                "You can only change the store for Admins, Users, or Guests.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Perform the update
        const [updatedUser] = await db
            .update(users)
            .set({ storeId: newStoreId, lastModified: new Date() })
            .where(eq(users.id, targetUserId))
            .returning();

        // 6. Log and respond
        await logActivity({
            userId: currentUser.id,
            storeId: String(currentUser.storeId),
            action: "USER_STORE_CHANGED",
            entityId: targetUserId,
            entityType: "user",
            details: `Store for user ${targetUser.firstName} ${targetUser.lastName} changed to store ID ${newStoreId}.`,
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = updatedUser;
        res.status(StatusCodes.OK).json(userWithoutPassword);
    } catch (error) {
        handleError2(
            res,
            "Failed to change user store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Update the current user's password
 * @route   PATCH /users/update-password
 * @access  Private (for the logged-in user)
 */
export const updatePassword = async (req: CustomRequest, res: Response) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const currentUser = req.user?.data;

        // 1. Basic validation
        if (!currentUser) {
            return handleError2(
                res,
                "Authentication required.",
                StatusCodes.UNAUTHORIZED,
            );
        }
        if (!oldPassword || !newPassword) {
            return handleError2(
                res,
                "Old password and new password are required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        if (oldPassword === newPassword) {
            return handleError2(
                res,
                "Old password and new password must be different.",
                StatusCodes.BAD_REQUEST,
            );
        }

        if (newPassword.length < 6) {
            return handleError2(
                res,
                "New password must be at least 6 characters long.",
                StatusCodes.BAD_REQUEST,
            );
        }

        // 2. Fetch the user's current password from the DB
        const userRecord = await db.query.users.findFirst({
            where: eq(users.id, currentUser.id),
            columns: { password: true },
        });

        if (!userRecord) {
            return handleError2(
                res,
                "User not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        // 3. Verify the old password
        const isMatch = await passwordHashService.compare(
            oldPassword,
            userRecord.password,
        );
        if (!isMatch) {
            return handleError2(
                res,
                "Incorrect old password.",
                StatusCodes.FORBIDDEN,
            );
        }

        // 4. Hash the new password and update the database
        const hashedNewPassword = await passwordHashService.hash(newPassword);
        await db
            .update(users)
            .set({ password: hashedNewPassword, lastModified: new Date() })
            .where(eq(users.id, currentUser.id));

        // Log activity for password change
        await logActivity({
            userId: currentUser.id,
            storeId: String(currentUser.storeId),
            action: "PASSWORD_CHANGED",
            entityId: currentUser.id,
            entityType: "user",
            details: `Password changed by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.OK).json({
            message: "Password updated successfully.",
        });
    } catch (error) {
        // console.error("Error updating password:", error);
        handleError2(
            res,
            "Failed to update password.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

export const loginUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    passport.authenticate(
        "user",
        async function (
            error: Error,
            user: Express.User,
            info: { message: string },
        ) {
            if (error) {
                return handleError2(
                    res,
                    "Server error",
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    error,
                );
            }

            if (!user) {
                return handleError2(
                    res,
                    info.message || "Authentication failed",
                    StatusCodes.UNAUTHORIZED,
                );
            }

            // prevent login of pseudo-deleted users
            const data = await db.query.users.findFirst({
                where: and(
                    eq(users.id, user.data.id),
                    ne(users.status, UserStatusEnum.DELETED),
                ),
            });

            if (!data) {
                return handleError2(
                    res,
                    "Incorrect email or password.",
                    StatusCodes.UNAUTHORIZED,
                );
            }

            req.login(user, (loginError) => {
                if (loginError) {
                    console.error("Login error:", loginError);
                    return handleError2(
                        res,
                        "Login failed, please try again.",
                        StatusCodes.INTERNAL_SERVER_ERROR,
                    );
                }

                // Generate the token and send it in the response
                const token = generateToken(user.data);

                if (!token) {
                    return handleError2(
                        res,
                        "Token generation failed.",
                        StatusCodes.INTERNAL_SERVER_ERROR,
                    );
                }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password, ...userWithoutPassword } = user.data;
                return res
                    .status(StatusCodes.OK)
                    .json({ token, user: userWithoutPassword });
            });
        },
    )(req, res, next);
};

export const logoutUser = async (req: Request, res: Response) => {
    return res.status(StatusCodes.OK).json({ message: "Logout successful" });
};

export const getUserAccess = async (req: CustomRequest, res: Response) => {
    try {
        const user = req.user;

        const access = {
            id: user?.data.id,
            role: user?.data.role,
            firstName: user?.data.firstName,
            lastName: user?.data.lastName,
            email: user?.data.email,
            phone: user?.data.phone,
            status: user?.data.status,
            storeId: user?.data.storeId,
            createdAt: user?.data.createdAt,
            lastModified: user?.data.lastModified,
        };

        res.status(StatusCodes.OK).json(access);
    } catch (error) {
        // console.error(error);
        handleError2(
            res,
            "Problem loading user access, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};
