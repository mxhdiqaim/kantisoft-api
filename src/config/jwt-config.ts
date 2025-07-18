import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import db from "../db";
import { UserSchemaT, users } from "../schema/users-schema";
import { eq } from "drizzle-orm";

const secret = process.env.JWT_SECRET;

if (!secret) {
    throw new Error("JWT_SECRET is not defined in your environment variables");
}

/**
 * The structure of the payload encoded in the JWT.
 */

interface JwtPayload {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
    phone: string;
}

/**
 * Generates a JWT for a given user.
 * @param user The user objects to encode in the token.
 * @returns The generated JWT.
 */
export const generateToken = (user: Omit<UserSchemaT, "password">): string => {
    return jwt.sign(user, secret, { expiresIn: "1h" });
};

/**
 * Middleware to protect routes by verifying a JWT.
 * It checks for a token in the Authorisation header, verifies it,
 * and attaches the decoded user payload to the request object.
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const protectedRoute = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
            const decoded = jwt.verify(token, secret) as JwtPayload;

            // Fetch the user from the database to get the latest data
            const currentUser = await db.query.users.findFirst({
                where: eq(users.id, decoded.id),
            });

            if (!currentUser) {
                return res
                    .status(401)
                    .json({ message: "Not authorized, user not found" });
            }

            // Correctly structure req.user to match the application's type definition
            req.user = { data: currentUser };

            next();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            return res
                .status(401)
                .json({ message: "Not authorized, token failed" });
        }
    } else {
        res.status(401).json({ message: "Not authorized, no token" });
    }
};
