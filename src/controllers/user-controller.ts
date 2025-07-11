import {and, eq, ne} from "drizzle-orm";
import {NextFunction, Request, Response} from "express";
import passport from "passport";

import {generateToken} from '../config/jwt-config';
import db from "../db";
import {users} from "../schema/users-schema";
import {handleError} from "../service/error-handling";
import {passwordHashService} from "../service/password-hash-service";
import {UserRoleEnum, UserStatusEnum} from "../types/enums";

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const {query} = req;
        const user = req.user?.data;
        const isAdmin = user?.role === UserRoleEnum.ADMIN;

        // quick solution
        // in the future, we need to handle all filter/sort operators on any field
        const hasRole = "role" in query;

        const data = await db
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
            .where(and(
                    hasRole ? eq(users.role, query.role as UserRoleEnum) : undefined,
                    !isAdmin
                        ? ne(users.status, UserStatusEnum.DELETED)
                        : undefined
                )
            );

        res.status(200).json(data);
    } catch (error) {
        handleError(res, error);
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const payload = req.body;
        const currentUser = req.user?.data;

        // Check if the user is authenticated
        if (!currentUser) {
            return handleError(res, "User not authenticated", 403);
        }

        const {role: currentRole} = currentUser;
        const {role: targetRole} = payload;


        // Role-based creation rules
        if (currentRole === UserRoleEnum.USER || currentRole === UserRoleEnum.GUEST) {
            return handleError(res, "You don't have permission to create users", 403);
        }

        if (currentRole !== UserRoleEnum.ADMIN && (targetRole === UserRoleEnum.ADMIN || targetRole === UserRoleEnum.CASHIER)) {
            if (targetRole !== "admin") {
                return handleError(res, "You don't have permission to create users with this role", 403);
            }
        }

        const hashedPassword = passwordHashService(payload.password);

        await db
            .insert(users)
            .values({
                ...payload,
                password: hashedPassword,
            });

        res.status(200).json(null);
    } catch (error) {
        handleError(res, error);
    }
};

export const loginUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    passport.authenticate(
        "user",
        async function (
            error: Error,
            user: Express.User,
            info: { message: string }
        ) {
            if (error) {
                return res.status(500).json(error);
            }

            if (!user) {
                return res.status(401).json({message: info.message});
            }

            // prevent login of pseudo-deleted users
            const data = await db.query.users.findFirst({
                where: and(
                    eq(users.id, user.data.id),
                    ne(users.status, UserStatusEnum.DELETED)
                ),
            });

            if (!data) {
                return res.status(401).json({message: "Incorrect email or password."});
            }

            req.login(user, (loginError) => {
                if (loginError) {
                    return res.status(500).json(loginError);
                }

                // Generate the token and send it in the response
                const token = generateToken(user.data);

                return res.status(200).json({token: token});
            });
        }
    )(req, res, next);
};

export const logoutUser = async (req: Request, res: Response) => {
    const {user} = req;

    if (!user) {
        res.status(401).json({message: "Sorry, you have to login first."});
    }

    req.logout((error) => {
        if (error) {
            res.status(500).json(error);
        }

        res.status(200).json({message: "Logged out successfully"});
    });
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
        handleError(res, error);
    }
};
