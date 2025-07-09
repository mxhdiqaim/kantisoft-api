import http from "http";
import cors from "cors";
import express from "express";
import path from "path";
import morgan from "morgan";

import "./config/auth-config";
// import configureSession from "./config/session-config";

import routes from "./routes";
// import authorityCheck from "./config/authorize-config";

const app = express();
const URL =
    process.env.NODE_ENV === "development"
        ? ["http://localhost:3000", "http://localhost:3001"]
        : [`https://${process.env.CLIENT_DOMAIN}` /* `https://${process.env.FORM_DOMAIN}` */];

/** Session */
// configureSession(app);

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

/* Protect Routes */
// app.use(authorityCheck);

/** Routes */
app.use(routes);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("Welcome to the API");
});

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
