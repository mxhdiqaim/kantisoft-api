import { Express } from "express";

import passport from "passport";
import session from "express-session";
import pgSession from "connect-pg-simple";

import { pool } from "../db";

const pgStore = pgSession(session);

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) throw new Error("Env variable SESSION_SECRET needed");

const configureSession = (app: Express) => {
    const localDevCookie = {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: false,
    };

    app.use(
        session({
            resave: false,
            saveUninitialized: false,
            store: new pgStore({ pool, createTableIfMissing: true }),
            secret: SESSION_SECRET,
            cookie: process.env.NODE_ENV === "development" ? localDevCookie : undefined,
        })
    );

    app.use(passport.initialize());
    app.use(passport.session());
};

export default configureSession;
