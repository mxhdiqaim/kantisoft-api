/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, ne, or, SQL } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import passport from "passport";

import { generateToken } from "../config/jwt-config";
import db from "../db";
import { InsertUserSchemaT, users } from "../schema/users-schema";
import { handleError } from "../service/error-handling";
import { passwordHashService } from "../service/password-hash-service";
import { StatusCodeEnum, UserRoleEnum, UserStatusEnum } from "../types/enums";
import { stores } from "../schema/stores-schema";
import { CustomRequest } from "../types/express";
import { logActivity } from "../service/activity-logger";

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
            return handleError(
                res,
                "First name, email, password, store name, and store type are required.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        // Normalize phone input: Convert empty string or undefined to null
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
                return handleError(
                    res,
                    "A user with this email already exists.",
                    StatusCodeEnum.CONFLICT,
                );
            } else if (
                normalizedPhone !== null &&
                existingUser.phone === normalizedPhone
            ) {
                return handleError(
                    res,
                    "A user with this phone number already exists.",
                    StatusCodeEnum.CONFLICT,
                );
            } else {
                // Fallback for general case or if both match (less likely with specific checks above)
                return handleError(
                    res,
                    "A user with this email or phone number already exists.",
                    StatusCodeEnum.CONFLICT,
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

        res.status(StatusCodeEnum.CREATED).json({
            user: userWithoutPassword,
            token,
        });
    } catch (error: any) {
        console.error("Registration Error:", error);
        // CRITICAL FIX: Add more specific error handling for unique constraints.
        // If the database constraint (e.g., users_storeId_phone_unique) is violated,
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
                        return handleError(
                            res,
                            "A user with this email already exists globally.",
                            StatusCodeEnum.CONFLICT,
                        );
                    case "users_storeId_email_unique": // Your storeId, email unique constraint
                        return handleError(
                            res,
                            "A user with this email already exists within a store.",
                            StatusCodeEnum.CONFLICT,
                        );
                    case "users_storeId_phone_unique": // Your storeId, phone unique constraint
                        return handleError(
                            res,
                            "A user with this phone number already exists within a store.",
                            StatusCodeEnum.CONFLICT,
                        );
                }
            }
        }
        handleError(
            res,
            "Registration failed. Please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @desc    Get all users (Admin only)
 * @route   GET /users
 * @access  Private Managers | Admins
 *          Managers can see all users in their store, Admins can on only the users in their store
 */
export const getAllUsers = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        // Multi-tenancy check: Ensure the user is authenticated and has a storeId.
        if (
            !storeId ||
            (currentUser?.role !== UserRoleEnum.MANAGER &&
                currentUser?.role !== UserRoleEnum.ADMIN)
        ) {
            return handleError(
                res,
                "You do not have permission to view all users.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

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
            })
            .from(users)
            .where(eq(users.storeId, String(storeId)));

        // await logActivity({
        //     userId: currentUser.id,
        //     storeId: storeId,
        //     action: "USERS_VIEWED",
        //     details: `All users viewed by ${currentUser.firstName} ${currentUser.lastName}.`,
        // });

        res.status(StatusCodeEnum.OK).json(allUsers);
    } catch (error) {
        console.error("Error fetching all users:", error);
        return handleError(
            res,
            "Failed to fetch users.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
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
        const userStoreId = currentUser?.storeId;

        // Check if a user is authenticated
        if (!currentUser || !userStoreId) {
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Fetch the user profile that is being requested
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, targetUserId),
                eq(users.storeId, String(userStoreId)), // <-- CRITICAL FIX: Add multi-tenancy filter
            ),
        });

        if (!targetUser) {
            return handleError(
                res,
                "User not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        // Authorization Logic
        const isManager = currentUser.role === UserRoleEnum.MANAGER;
        const isOwnProfile = currentUser.id === targetUser.id;
        const isAdminInSameStore =
            currentUser.role === UserRoleEnum.ADMIN &&
            currentUser.storeId === targetUser.storeId;

        // Deny access if none of the conditions are met
        if (!isManager && !isOwnProfile && !isAdminInSameStore) {
            return handleError(
                res,
                "You do not have permission to view this profile.",
                StatusCodeEnum.FORBIDDEN,
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

        // 5. Return user data without the password
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = targetUser;
        res.status(StatusCodeEnum.OK).json(userWithoutPassword);
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        handleError(
            res,
            "Failed to fetch user.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
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
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Prevent users from deleting themselves
        if (currentUser.id === targetUserId) {
            return handleError(
                res,
                "You cannot perform this action",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // Fetch the user to be deleted, but only if they are in the current user's store.
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, targetUserId),
                eq(users.storeId, String(currentUser.storeId)), // <-- CRITICAL FIX: Add multi-tenancy filter
            ),
        });

        if (!targetUser) {
            return handleError(
                res,
                "User not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        // Authorization Logic: Who can delete whom?
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
            return handleError(
                res,
                "You do not have permission to delete this user.",
                StatusCodeEnum.FORBIDDEN,
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

        res.status(StatusCodeEnum.OK).json({
            message: "User account has been successfully deleted.",
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        handleError(
            res,
            "Failed to delete user.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

export const createUser = async (req: CustomRequest, res: Response) => {
    try {
        const payload = req.body;
        const currentUser = req.user?.data;

        // Check if the user is authenticated
        if (!currentUser) {
            return handleError(
                res,
                "User not authenticated",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // CRITICAL FIX: Get the storeId from the current user
        const storeId = currentUser.storeId;
        if (!storeId) {
            return handleError(
                res,
                "User does not belong to a store.",
                StatusCodeEnum.FORBIDDEN,
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
            return handleError(
                res,
                "A user with this email already exists in this store.",
                StatusCodeEnum.CONFLICT,
            );
        }

        // Authorization: Current user's role vs. target user's role
        const { role: currentRole } = currentUser;
        const { role: targetRole } = payload;

        // Define allowed roles for creation based on the current user's role
        const allowedCreations: { [key: string]: string[] } = {
            [UserRoleEnum.MANAGER]: [
                // UserRoleEnum.MANAGER,
                UserRoleEnum.ADMIN,
                UserRoleEnum.USER,
                UserRoleEnum.GUEST,
            ],
            [UserRoleEnum.ADMIN]: [
                // UserRoleEnum.ADMIN,
                UserRoleEnum.USER,
                UserRoleEnum.GUEST,
            ],
        };

        // Get the list of roles the current user is allowed to create
        const canCreateRoles = allowedCreations[currentRole] || [];

        if (!canCreateRoles.includes(targetRole)) {
            return handleError(
                res,
                "You don't have permission to create this user type.",
                StatusCodeEnum.FORBIDDEN,
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

        res.status(StatusCodeEnum.CREATED).json(userWithoutPassword);
    } catch (error: any) {
        console.error(error);
        // *** CRITICAL CHANGE 4: More specific error handling for unique constraints ***
        if (error.cause && error.cause.code === "23505") {
            // PostgreSQL unique violation error code
            if (error.cause.constraint === "users_email_unique") {
                return handleError(
                    res,
                    "A user with this email already exists.",
                    StatusCodeEnum.CONFLICT,
                );
            }
            if (error.cause.constraint === "users_storeId_phone_unique") {
                // Your new constraint name
                return handleError(
                    res,
                    "A user with this phone number already exists in this store.",
                    StatusCodeEnum.CONFLICT,
                );
            }
        }
        handleError(
            res,
            "Problem creating user, please try again",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
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
        const updateData = req.body;

        // Authenticated check
        if (!currentUser) {
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Fetch the user to be updated
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, targetUserId),
                eq(users.storeId, String(currentUser.storeId)), // <-- CRITICAL FIX: Add multi-tenancy filter
            ),
        });

        if (!targetUser) {
            return handleError(
                res,
                "User not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        // Sanitize payload - password cannot be updated here
        delete updateData.password;
        delete updateData.id; // Prevent changing the ID

        const isSelfUpdate = currentUser.id === targetUserId;
        const isManager = currentUser.role === UserRoleEnum.MANAGER;
        const isAdmin = currentUser.role === UserRoleEnum.ADMIN;

        // Authorization Logic
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
            // Admins can update users in their store, but not Managers
            if (
                targetUser.role !== UserRoleEnum.MANAGER &&
                currentUser.storeId === targetUser.storeId
            ) {
                // Admins cannot change a user's role or store assignment
                delete updateData.role;
                delete updateData.storeId;
                canUpdate = true;
            }
        }

        if (!canUpdate) {
            return handleError(
                res,
                "You do not have permission to update this user.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // 5. Perform the update
        if (Object.keys(updateData).length === 0) {
            return handleError(
                res,
                "No valid fields provided for update.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        // Multi-tenancy enforcement: CRITICAL - Secure the update statement with storeId
        const [updatedUser] = await db
            .update(users)
            .set({ ...updateData, lastModified: new Date() })
            .where(
                and(
                    eq(users.id, targetUserId),
                    eq(users.storeId, String(currentUser.storeId)), // <-- CRITICAL FIX: Secure the update statement
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
        res.status(StatusCodeEnum.OK).json(userWithoutPassword);
    } catch (error) {
        console.error("Error updating user:", error);
        handleError(
            res,
            "Failed to update user.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
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
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }
        if (!oldPassword || !newPassword) {
            return handleError(
                res,
                "Old password and new password are required.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        if (oldPassword === newPassword) {
            return handleError(
                res,
                "Old password and new password must be different.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        if (newPassword.length < 6) {
            return handleError(
                res,
                "New password must be at least 6 characters long.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        // 2. Fetch the user's current password from the DB
        const userRecord = await db.query.users.findFirst({
            where: eq(users.id, currentUser.id),
            columns: { password: true },
        });

        if (!userRecord) {
            return handleError(
                res,
                "User not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        // 3. Verify the old password
        const isMatch = await passwordHashService.compare(
            oldPassword,
            userRecord.password,
        );
        if (!isMatch) {
            return handleError(
                res,
                "Incorrect old password.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // 4. Hash the new password and update the database
        const hashedNewPassword = await passwordHashService.hash(newPassword);
        await db
            .update(users)
            .set({ password: hashedNewPassword, lastModified: new Date() })
            .where(eq(users.id, currentUser.id));

        // // Log activity for password change
        // await logActivity({
        //     userId: currentUser.id,
        //     storeId: String(currentUser.storeId),
        //     action: "PASSWORD_CHANGED",
        //     entityId: currentUser.id,
        //     entityType: "user",
        //     details: `Password changed by ${currentUser.firstName} ${currentUser.lastName}.`,
        // });

        res.status(StatusCodeEnum.OK).json({
            message: "Password updated successfully.",
        });
    } catch (error) {
        console.error("Error updating password:", error);
        handleError(
            res,
            "Failed to update password.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
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
                return handleError(
                    res,
                    error instanceof Error ? error.message : "Server error",
                    StatusCodeEnum.INTERNAL_SERVER_ERROR,
                );
                return res.status(500).json(error);
            }

            if (!user) {
                return handleError(
                    res,
                    info.message || "Authentication failed",
                    StatusCodeEnum.UNAUTHORIZED,
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
                return handleError(
                    res,
                    "Incorrect email or password.",
                    StatusCodeEnum.UNAUTHORIZED,
                );
            }

            req.login(user, (loginError) => {
                if (loginError) {
                    console.error("Login error:", loginError);
                    return handleError(
                        res,
                        "Login failed, please try again.",
                        StatusCodeEnum.INTERNAL_SERVER_ERROR,
                    );
                }

                // Generate the token and send it in the response
                const token = generateToken(user.data);

                if (!token) {
                    return handleError(
                        res,
                        "Token generation failed.",
                        StatusCodeEnum.INTERNAL_SERVER_ERROR,
                    );
                }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password, ...userWithoutPassword } = user.data;
                return res
                    .status(StatusCodeEnum.OK)
                    .json({ token, user: userWithoutPassword });
            });
        },
    )(req, res, next);
};

export const logoutUser = async (req: Request, res: Response) => {
    return res.status(StatusCodeEnum.OK).json({ message: "Logout successful" });
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

        res.status(StatusCodeEnum.OK).json(access);
    } catch (error) {
        console.error(error);
        handleError(
            res,
            "Problem loading user access, please try again",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
