import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { getEnvVariable } from "../utils";
// import * as Sentry from "@sentry/node";

export const handleError2 = (
    res: Response,
    message: string,
    statusCode: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR,
    error?: Error,
) => {
    // Only log in development
    const NODE_ENV = getEnvVariable("NODE_ENV");
    if (NODE_ENV === "development") {
        console.log("An error occurred with status code:", statusCode);
        console.error("Error message:", message);

        if (error) {
            console.error("Error details:", error);
            console.error("Stack trace:", error.stack);
        }
    }

    // Capture the exception with Sentry
    // Sentry.captureException(error);
    // Use a generic message for 500 errors in production
    const errorMessage =
        statusCode === StatusCodes.INTERNAL_SERVER_ERROR
            ? "Internal Server Error"
            : message;

    return res.status(statusCode).json({
        type: statusCode,
        message: errorMessage,
    });
};
