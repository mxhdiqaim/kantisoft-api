import { and, eq, ne } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import passport from "passport";

import { generateToken } from "../config/jwt-config";
import db from "../db";
import { users } from "../schema/users-schema";
import { handleError } from "../service/error-handling";
import { passwordHashService } from "../service/password-hash-service";
import { StatusCodeEnum, UserRoleEnum, UserStatusEnum } from "../types/enums";

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/users
 * @access  Private/Admin
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

        const hashedPassword = passwordHashService(payload.password);

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
                return res.status(500).json(error);
            }

            if (!user) {
                return res.status(401).json({ message: info.message });
            }

            // prevent login of pseudo-deleted users
            const data = await db.query.users.findFirst({
                where: and(
                    eq(users.id, user.data.id),
                    ne(users.status, UserStatusEnum.DELETED),
                ),
            });

            if (!data) {
                return res
                    .status(401)
                    .json({ message: "Incorrect email or password." });
            }

            req.login(user, (loginError) => {
                if (loginError) {
                    return res.status(500).json(loginError);
                }

                // Generate the token and send it in the response
                const token = generateToken(user.data);

                if (!token) {
                    return res
                        .status(500)
                        .json({ message: "Token generation failed." });
                }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password, ...userWithoutPassword } = user.data;
                return res
                    .status(200)
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
    return res.status(200).json({ message: "Logout successful" });
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

        res.status(200).json(access);
    } catch (error) {
        console.error(error);
        handleError(
            res,
            "Problem loading user access, please try again",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
