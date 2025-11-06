import "dotenv/config";
import * as db from "./src/db";
import server, { setRateLimiter } from "./src/server";
import { getEnvVariable } from "./src/utils";
import redisClient, { connectRedis } from "./src/config/redis-config";
import {
    getApiLimiter,
    initializeApiLimiter,
} from "./src/middlewares/rate-limiter";

const PORT = parseInt(getEnvVariable("PORT"));

(async () => {
    await db
        .connect()
        .then(() => console.log("Database connection has been established"))
        .catch((err) =>
            console.error("Failed to connect to the database", err),
        );

    await connectRedis().catch((err) => {
        console.error("Failed to connect to Redis:", err);
        process.exit(1);
    });

    await new Promise<void>((resolve, reject) => {
        redisClient.on("ready", () => {
            console.log("Redis is ready");
            resolve();
        });

        setTimeout(() => {
            if (!redisClient.isReady) {
                reject(
                    new Error(
                        "Redis client failed to become ready within timeout.",
                    ),
                );
            }
        }, 5000);
    });

    initializeApiLimiter();
    console.log("Rate limiter initialized");

    // Set the rate limiter middleware
    setRateLimiter(getApiLimiter());
    console.log("Rate limiter applied to routes");

    server.on("error", (error: NodeJS.ErrnoException) => {
        const bind = "Port " + PORT;

        switch (error.code) {
            case "EACCES":
                console.error(bind + " requires elevated privileges");
                return;

            case "EADDRINUSE":
                console.error(bind + " is already in use");
                return;
            default:
                console.error(error);
        }
    });

    server.on("listening", () => {
        const addr = server.address();
        const bind =
            typeof addr === "string" ? "pipe " + addr : "port " + addr?.port;

        console.log(`Server has been started and listening on ${bind}`);
    });

    server.listen(PORT);
})();
