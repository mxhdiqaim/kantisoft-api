import "dotenv/config";
import * as db from "./src/db";
import server from "./src/server";
import { getEnvVariable } from "./src/utils";

const PORT = parseInt(getEnvVariable("PORT"));

(async () => {
    await db
        .connect()
        .then(() => console.log("Database connection has been established"))
        .catch((err) =>
            console.error("Failed to connect to the database", err),
        );

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
