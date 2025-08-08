import { and, eq, ne } from "drizzle-orm";
import jwt from "jsonwebtoken";
import passport from "passport";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import db from "../db";
import { users, UserSchemaT } from "../schema/users-schema";
import { UserStatusEnum } from "../types/enums";
import { AuthUserT } from "./auth-config";

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

    const userData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        storeId: user.storeId,
        createdAt: user.createdAt,
        lastModified: user.lastModified,
    };

    return jwt.sign(userData, JWT_SECRET, {
        expiresIn: "12h",
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
