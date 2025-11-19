import { Response } from "express";
import { StatusCodeEnum } from "../types/enums";
import { StatusCodes } from "http-status-codes";
import { getEnvVariable } from "../utils";

export const handleError = (
    res: Response,
    message: string,
    statusCode:
        | StatusCodeEnum
        | StatusCodes = StatusCodeEnum.INTERNAL_SERVER_ERROR |
        StatusCodes.INTERNAL_SERVER_ERROR,
) => {
    const errorObj = { type: statusCode, message };

    const errorMessage =
        statusCode === StatusCodes.INTERNAL_SERVER_ERROR
            ? "Internal Server Error"
            : errorObj.message || Error;

    if (process.env.NODE_ENV === "development") {
        console.log("An error occurred with the type:", errorObj.type);
        console.error(errorObj.message || "An error occurred:", errorObj);

        return res
            .status(statusCode)
            .json({ type: errorObj.type || "error", message: errorMessage });
    }

    return res.status(statusCode).json({
        type: errorObj.type,
        message: errorObj.message,
    });
};

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
