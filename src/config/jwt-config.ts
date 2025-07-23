// import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import db from "../db";
import { UserSchemaT, users } from "../schema/users-schema";
import { and, eq, ne } from "drizzle-orm";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { UserStatusEnum } from "../types/enums";
import { AuthUserT } from "./auth-config";
import passport from "passport";

// Define the JWT payload structure
// interface JwtPayload {
//     id: string;
//     email: string;
//     role: string;
//     firstName: string;
//     lastName: string;
//     phone: string;
// }

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in your environment variables");
}

/**
 * Generates a JWT for a given user.
 * @param user The user objects to encode in the token.
 * @returns The generated JWT.
 */
export const generateToken = (user: UserSchemaT) => {
    if (!user || !user.id) {
        return null;
    }
    return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: "1d",
    });
};

const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
};

passport.use(
    "jwt",
    new JwtStrategy(opts, async (jwt_payload, done) => {
        try {
            const userId = jwt_payload.id;

            // On every authenticated request, check the user's status in the database.
            const user = await db.query.users.findFirst({
                where: and(
                    eq(users.id, userId),
                    // IMPORTANT: Ensure the user has not been deleted.
                    ne(users.status, UserStatusEnum.DELETED),
                ),
            });

            if (user) {
                // User was found and is active. Authentication is successful.
                const authUser: AuthUserT = { data: user };
                return done(null, authUser);
            } else {
                // User was not found OR their status is 'deleted'.
                // This invalidates their token immediately.
                return done(null, false);
            }
        } catch (error) {
            return done(error, false);
        }
    }),
);

// This is your main authentication middleware for protected routes.
export const protectedRoute = passport.authenticate("jwt", { session: false });

// /**
//  * Middleware to protect routes by verifying a JWT.
//  * It checks for a token in the Authorisation header, verifies it,
//  * and attaches the decoded user payload to the request object.
//  * @param req - The Express request object.
//  * @param res - The Express response object.
//  * @param next - The next middleware function.
//  */
// export const protectedRoute = async (
//     req: Request,
//     res: Response,
//     next: NextFunction,
// ) => {
//     const authHeader = req.headers.authorization;

//     if (authHeader && authHeader.startsWith("Bearer ")) {
//         const token = authHeader.substring(7); // Remove 'Bearer ' prefix

//         try {
//             const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

//             // Fetch the user from the database to get the latest data
//             const currentUser = await db.query.users.findFirst({
//                 where: eq(users.id, decoded.id),
//             });

//             if (!currentUser) {
//                 return res
//                     .status(401)
//                     .json({ message: "Not authorized, user not found" });
//             }

//             // Correctly structure req.user to match the application's type definition
//             req.user = { data: currentUser };

//             next();
//             // eslint-disable-next-line @typescript-eslint/no-unused-vars
//         } catch (error) {
//             return res
//                 .status(401)
//                 .json({ message: "Not authorized, token failed" });
//         }
//     } else {
//         res.status(401).json({ message: "Not authorized, no token" });
//     }
// };
