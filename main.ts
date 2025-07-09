import "dotenv/config";
import * as db  from "./src/db"

(async () => {
    await db
        .connect()
        .then(() => console.log("Database connection has been established"))
        .catch((err) => console.error("Failed to connect to the database", err));

    const port = parseInt(process.env.PORT || "5473");
    const server = (await import("./src/server")).default;

    server.on("error", (error: NodeJS.ErrnoException) => {
        const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

        switch (error.code) {
            case "EACCES":
                console.error(bind + " requires elevated privileges");
                process.exit(1);
                break;
            case "EADDRINUSE":
                console.error(bind + " is already in use");
                process.exit(1);
                break;
            default:
                console.error(error);
        }
    });

    server.on("listening", () => {
        const addr = server.address();
        const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr?.port;

        console.log(`Server has been started and listening on ${bind}`);
    });

    server.listen(port);
})();
