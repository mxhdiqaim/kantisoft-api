import { NextFunction, Request, Response } from "express";
import { and, eq, ne } from "drizzle-orm";
import db from "../db";
import { /* managers, */ users } from "../schema/users-schema";
import { handleError } from "../service/error-handling";
import { passwordHashService } from "../service/password-hash-service";
import passport from "passport";
import { UserStatusEnum, UserRoleEnum } from "../types/enums";

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const { query } = req;
        const user = req.user?.data;
        const isAdmin = user?.role === UserRoleEnum.ADMIN;

        // quick solution
        // in the future, we need to handle all filter/sort operators on any field
        const hasRole = "role" in query;

        const data = await db
            .select()
            .from(users)
            .where(
                // query.role is a string, asserted as any over string because of a wrong type mismatch from users.role
                and(
                    hasRole ? eq(users.role, query.role as UserRoleEnum) : undefined,
                    !isAdmin
                        ? ne(users.status, String(UserStatusEnum.DELETED))
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

        const currentRole = currentUser.role;
        const targetRole: UserRoleEnum = payload.role;

        // Role-based creation rules
        if (currentRole === "user") {
            return handleError(res, "You don't have permission to create users", 403);
        }

        if (currentRole === "admin" && targetRole !== "cashier" && targetRole !== "user" && targetRole !== "guest") {
            // Admin
            if (targetRole !== "admin") {
                return handleError(res, "Only Admin can create another admins", 403);
            }
        }

        if (currentRole === "user") {
            // Admin
            if (targetRole === "admin" || targetRole === "cashier" || targetRole === "user" || targetRole === "guest") {
                return handleError(res, "Only Adming can create cashier, users or guests", 403);
            }
        }

        const hashedPassword = passwordHashService(payload.password);

        const created = await db
            .insert(users)
            .values({
                ...payload,
                password: hashedPassword,
            })
            .returning();

        // If creating an admin (should only be possible through admin)
        if (targetRole === "admin") {
            await db.insert(users).values({
                ...created[0],
                role: UserRoleEnum.ADMIN,
            });
        }

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
                return res.status(401).json(info.message);
            }

            // prevent login of pseudo-deleted users
            const data = await db.query.users.findFirst({
                where: and(
                    eq(users.id, user.data.id),
                    ne(users.status, String(UserStatusEnum.DELETED))
                ),
            });

            if (!data) {
                return res.status(401).json("Invalid Credentials");
            }

            req.login(user, (loginError) => {
                if (loginError) {
                    return res.status(500).json(loginError);
                }

                return res.status(200).json(user.data);
            });
        }
    )(req, res, next);
};

export const logoutUser = async (req: Request, res: Response) => {
    const { user } = req;

    if (!user) {
        res.status(401).json("User session expired");
    }

    req.logout((error) => {
        if (error) {
            res.status(500).json(error);
        }

        res.status(200).json(user);
    });
};

export const getUserAccess = async (req: Request, res: Response) => {
    try {
        const user = req.user;

        const access = {
            id: user?.data.id,
            role: user?.data.role,
        };

        res.status(200).json(access);
    } catch (error) {
        handleError(res, error);
    }
};
