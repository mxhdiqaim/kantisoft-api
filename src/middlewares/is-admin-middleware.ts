import { Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";

import { CustomRequest } from "../types/express";

export const isAdmin = (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
) => {
    // Assumes a previous middleware has authenticated the user and attached user info to req.user
    if (req.user && req.user.data && req.user.data.role === "admin") {
        return next();
    }
    return handleError(
        res,
        "Access denied. You do not have permission to perform this action.",
        StatusCodeEnum.FORBIDDEN,
    );
};
