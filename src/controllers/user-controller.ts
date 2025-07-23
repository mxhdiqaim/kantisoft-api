import { and, eq, ne, or } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import passport from "passport";

import { generateToken } from "../config/jwt-config";
import db from "../db";
import { users } from "../schema/users-schema";
import { handleError } from "../service/error-handling";
import { passwordHashService } from "../service/password-hash-service";
import { StatusCodeEnum, UserRoleEnum, UserStatusEnum } from "../types/enums";
import { stores } from "../schema/stores-schema";

/**
 * @desc    Register a new Manager and their first Store
 * @route   POST /api/auth/register
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

        // Check for existing user
        const existingUser = await db.query.users.findFirst({
            where: or(eq(users.email, email), eq(users.phone, phone)),
        });

        if (existingUser) {
            return handleError(
                res,
                "A user with this email or phone number already exists.",
                StatusCodeEnum.CONFLICT,
            );
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
                    phone,
                    role: UserRoleEnum.MANAGER, // Automatically a manager
                    status: UserStatusEnum.ACTIVE,
                    storeId: newStore.id, // Link to the new store
                })
                .returning();

            // Generate a token for the new user
            const token = generateToken(newUser);

            return { user: newUser, token };
        });

        // Return the new user (without password) and the token
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;

        res.status(StatusCodeEnum.CREATED).json({
            user: userWithoutPassword,
            token,
        });
    } catch (error) {
        console.error("Registration Error:", error);
        handleError(
            res,
            "Registration failed. Please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/users
 * @access  Private Managers | Admins
 *          Managers can see all users in their store, Admins can on only the users in their store
 */
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        // Fetch all users, excluding the password field for security
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
            .from(users);

        res.status(200).json(allUsers);
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
 * @route   GET /api/users/:id
 * @access  Private (Manager, Admin of the same store, or the user themselves)
 */
export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id: targetUserId } = req.params;
        const currentUser = req.user?.data;

        // Check if a user is authenticated
        if (!currentUser) {
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Fetch the user profile that is being requested
        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
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
 * @route   DELETE /api/users/:id
 * @access  Private (Manager or Admin)
 */
export const deleteUser = async (req: Request, res: Response) => {
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

        // Fetch the user to be deleted to check their role and store
        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
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
            .where(eq(users.id, targetUserId));

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

export const createUser = async (req: Request, res: Response) => {
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

        const { role: currentRole } = currentUser;
        const { role: targetRole } = payload;

        // Define allowed roles for creation based on the current user's role
        const allowedCreations: { [key: string]: string[] } = {
            [UserRoleEnum.MANAGER]: [
                UserRoleEnum.ADMIN,
                UserRoleEnum.USER,
                UserRoleEnum.GUEST,
            ],
            [UserRoleEnum.ADMIN]: [UserRoleEnum.USER, UserRoleEnum.GUEST],
        };

        // Get the list of roles the current user is allowed to create
        const canCreateRoles = allowedCreations[currentRole] || [];

        if (!canCreateRoles.includes(targetRole)) {
            return handleError(
                res,
                "You don't have permission to create new user",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        const hashedPassword = passwordHashService.hash(payload.password);

        const [newUser] = await db
            .insert(users)
            .values({
                ...payload,
                password: hashedPassword,
            })
            .returning();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = newUser;

        res.status(StatusCodeEnum.CREATED).json(userWithoutPassword);
    } catch (error) {
        console.error(error);
        handleError(
            res,
            "Problem creating user, please try again",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @desc    Update a user's profile information
 * @route   PATCH /api/users/:id
 * @access  Private
 */
export const updateUser = async (req: Request, res: Response) => {
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
            where: eq(users.id, targetUserId),
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
            canUpdate = true;
            // Users cannot change their own role, store, or status
            delete updateData.role;
            delete updateData.storeId;
            delete updateData.status;
        } else if (isManager) {
            // Managers can update any user
            canUpdate = true;
        } else if (isAdmin) {
            // Admins can update users in their store, but not Managers
            if (
                targetUser.role !== UserRoleEnum.MANAGER &&
                currentUser.storeId === targetUser.storeId
            ) {
                canUpdate = true;
                // Admins cannot change a user's role or store assignment
                delete updateData.role;
                delete updateData.storeId;
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

        const [updatedUser] = await db
            .update(users)
            .set({ ...updateData, lastModified: new Date() })
            .where(eq(users.id, targetUserId))
            .returning();

        // 6. Return the updated user data (without password)
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
 * @route   PATCH /api/users/update-password
 * @access  Private (for the logged-in user)
 */
export const updatePassword = async (req: Request, res: Response) => {
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
    //    const { user } = req;
    //
    //    if (!user) {
    //        res.status(401).json({ message: "Sorry, you have to login first." });
    //    }

    //    req.logout((error) => {
    //        if (error) {
    //            res.status(500).json(error);
    //        }
    //
    //        res.status(200).json({ message: "Logged out successfully" });
    //    });
    return res.status(StatusCodeEnum.OK).json({ message: "Logout successful" });
};

export const getUserAccess = async (req: Request, res: Response) => {
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
