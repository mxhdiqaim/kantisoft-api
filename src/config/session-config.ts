import { Express } from "express";
import passport from "passport";
import session from "express-session";
// import { RedisStore } from "connect-redis";
// import redisClient from "./redis-config";
import { getEnvVariable } from "../utils";

const configureSession = (app: Express) => {
    const SESSION_SECRET = getEnvVariable("SESSION_SECRET");
    const NODE_ENV = getEnvVariable("NODE_ENV");

    // const redisStore = new RedisStore({
    //     client: redisClient,
    //     prefix: "sess:",
    //     serializer: JSON,
    // });

    app.use(
        session({
            // store: redisStore,
            secret: SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: NODE_ENV === "production", // use secure cookies in production
                httpOnly: true,
                maxAge: 2 * 60 * 60 * 1000, // 2 hours
            },
        }),
    );

    app.use(passport.initialize());
    app.use(passport.session());
};

export default configureSession;
