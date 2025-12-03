import "./config/sentry-config";
import cors from "cors";
import express from "express";
import http from "http";
import morgan from "morgan";
import "./config/auth-config";
import path from "path";
import configureSession from "./config/session-config";
import routes from "./routes";
import { getEnvVariable } from "./utils";
import { initializeSentry } from "./config/sentry-config";

export const app = express();

// Initialise Sentry
const SENTRY_DSN = getEnvVariable("SENTRY_DSN");
initializeSentry(SENTRY_DSN);

app.set("trust proxy", 1);

const NODE_ENV = getEnvVariable("NODE_ENV");
const LANDING_PAGE = getEnvVariable("LANDING_PAGE");
const APP_URL = getEnvVariable("APP_URL");

const URL =
    NODE_ENV === "development"
        ? [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://localhost:3002",
          ]
        : [`https://${LANDING_PAGE}`, `https://${APP_URL}`];

/** Session */
configureSession(app);

const corsOptions = {
    origin: URL, // FE origins
    methods: ["GET", "POST", "PATCH", "DELETE"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed request headers
    credentials: true, // Allow cookies and authentication headers
};

// CORS setup
app.use(cors(corsOptions));

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

/** Routes */
app.use("/api/v1", routes);

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
