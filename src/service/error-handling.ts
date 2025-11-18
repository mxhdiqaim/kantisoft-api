import { Response } from "express";
import { StatusCodeEnum } from "../types/enums";

export const handleError = (
    res: Response,
    message: string,
    statusCode: StatusCodeEnum = StatusCodeEnum.INTERNAL_SERVER_ERROR,
) => {
    const errorObj = { type: statusCode, message };

    const errorMessage =
        statusCode === 500
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
