import cors from "cors";
import express from "express";
import http from "http";
import morgan from "morgan";

import "./config/auth-config";
import path from "path";
// import authorityCheck from "./config/authorise-config";
import configureSession from "./config/session-config";

import routes from "./routes";

const app = express();
const URL =
    process.env.NODE_ENV === "development"
        ? ["http://localhost:3000", "http://localhost:3001"]
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
