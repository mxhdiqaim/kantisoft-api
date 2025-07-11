import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import db from '../db';

import { users, UserSchemaT } from '../schema/users-schema';

type UserT = {
    id: UserSchemaT['id'];
};

type AuthUserT = {
    data: UserSchemaT;
};

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        // eslint-disable-next-line
        interface User extends AuthUserT {}
    }
}

// steps for passport auth
// --> passport.use: returns user on login success
// --> passport.serialize: create cookie and add user identifiable data(id, type) extracted from user got from prev. step
// --> cookie is sent to browser as part of the created session
// --> cookie comes back in the session on next request
// --> passport.deserialize: uses that user id and type from cookie to get user data which is used to authenticate request (added to req object)

passport.serializeUser((user, done) => {
    const { data } = user;
    const _user = {
        id: data.id,
    };

    done(null, _user);
});

passport.deserializeUser(async (user: UserT, done) => {
    try {
        const fetchUserData = async () =>
            await db.query.users.findFirst({
                where: eq(users.id, user.id),
            });

        const data = await fetchUserData();

        if (!data) {
            return done(new Error('Wrong email or password'));
        }

        return done(null, { data });
    } catch (error) {
        return done(error);
    }
});

passport.use(
    'user',
    new LocalStrategy(
        { usernameField: 'email', passReqToCallback: true },
        async (req, email, password, done) => {
            try {
                const userData = await db.query.users.findFirst({
                    where: eq(users.email, email),
                });

                if (!userData) {
                    return done(null, false, {
                        message: 'Wrong email or password',
                    });
                }

                const isMatch = await bcrypt.compare(
                    password,
                    userData.password,
                );
                if (!isMatch) {
                    return done(null, false, {
                        message: 'Wrong email or password',
                    });
                }

                return done(null, { data: userData });
            } catch (error) {
                return done(error);
            }
        },
    ),
);
