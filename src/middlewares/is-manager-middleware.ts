import { Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum, UserRoleEnum } from "../types/enums";
import { CustomRequest } from "../types/express";

export const isManager = (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
) => {
    // Only users with the 'manager' role should have system-wide access
    if (req.user && req.user.data.role === UserRoleEnum.MANAGER) {
        return next();
    }

    return handleError(
        res,
        "Access denied. System Manager role required",
        StatusCodeEnum.FORBIDDEN,
    );
};
