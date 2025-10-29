import "dotenv/config";
import * as db from "./src/db";
import server from "./src/server";
import { getEnvVariable } from "./src/utils";
import redisClient from "./src/config/redis-config";

const PORT = parseInt(getEnvVariable("PORT"));

(async () => {
    await db
        .connect()
        .then(() => console.log("Database connection has been established"))
        .catch((err) =>
            console.error("Failed to connect to the database", err),
        );

    try {
        await redisClient.ping();
        console.log("Redis connection has been established");
    } catch (error) {
        console.error("Failed to connect to Redis", error);
    }

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
