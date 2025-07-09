import { Response } from "express";

type ErrorMessage = { isError: boolean; message: string };

// eslint-disable-next-line
type ErrorType = ErrorMessage | any;

export const handleError = (res: Response, error: ErrorType, statusCode: number = 500) => {
    const errorMessage = statusCode === 500 ? "Internal Server Error" : error.message || error;

    if (process.env.NODE_ENV === "development") {
        console.log("An error occurred, see the error below:");
        console.error(error);
        return res.status(statusCode).json({ isError: error.isError || true, message: errorMessage });
    }

    console.error(error); // log to a production server can be integrated with tools like Sentry
    return res.status(statusCode).json({
        isError: error.isError || true,
        message: errorMessage,
    });
};
