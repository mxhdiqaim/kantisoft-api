import dotenv from "dotenv";
import * as db from "./src/db";
import server, { app } from "./src/server";
import { getEnvVariable } from "./src/utils";
import { connectRedis } from "./src/config/redis-config";
import { createRateLimiter } from "./src/middlewares/rate-limiter";
// import "dotenv/config";

if (process.env.NODE_ENV === "production") {
    dotenv.config({ path: ".env.prod" });
} else {
    dotenv.config({ path: ".env.local" });
}

const PORT = parseInt(getEnvVariable("PORT"));

(async () => {
    // DB Connection
    await db
        .connect()
        .then(() => console.log("Database connection has been established"))
        .catch((err) =>
            console.error("Failed to connect to the database", err),
        );

    // Redis Connection
    await connectRedis();

    // Apply rate limiter after Redis is connected
    app.use(createRateLimiter());

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
