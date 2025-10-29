import cors from "cors";
import express from "express";
import http from "http";
import morgan from "morgan";

import "./config/auth-config";
import path from "path";
import configureSession from "./config/session-config";
import { createClient } from "redis";
import RedisStore from "rate-limit-redis";

import routes from "./routes";
import rateLimit from "express-rate-limit";
import { getEnvVariable } from "./utils";

const app = express();

const REDIS_PORT = parseInt(getEnvVariable("REDIS_PORT") || "6379");
const REDIS_HOST = getEnvVariable("REDIS_HOST");
const REDIS_PASSWORD = getEnvVariable("REDIS_PASSWORD");

// const INTERNAL_REDIS_PORT = 6379;

const redisClient = createClient({
    url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
    password: REDIS_PASSWORD,
});

redisClient.connect().catch(console.error);

// Rate limiter middleware
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again later.",

    store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
});

app.use(limiter);

const URL =
    process.env.NODE_ENV === "development"
        ? [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://localhost:8080",
          ]
        : [
              `https://${process.env.CLIENT_DOMAIN}` /* `https://${process.env.FORM_DOMAIN}` */,
          ];

/** Session */
configureSession(app);

// CORS setup
app.use(cors({ credentials: true, origin: URL }));

/** Logging */
app.use(morgan("dev"));

/** Parse the request */
app.use(express.urlencoded({ extended: false }));

/** Takes care of JSON data */
app.use(express.json({ limit: "5mb" }));

/** RULES OF OUR API */
app.use((req, res, next) => {
    next();
});

app.get("/", (_req, res) => {
    res.status(200).json({ message: "API is up and running" });
});

/* Protect Routes */
//app.use(authorityCheck);

/** Routes */
app.use(routes);

app.use(express.static(path.join(__dirname, "public")));

/** Error handling */
app.use((req, res, next) => {
    const error = new Error("not found");

    res.status(404).json({
        message: error.message,
    });

    next(error);
});

/** Server */
export default http.createServer(app);
