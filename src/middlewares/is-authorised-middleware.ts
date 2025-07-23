import { Request, Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum, UserRoleEnum } from "../types/enums";
import { AuthUserT } from "../config/auth-config";

interface AuthenticatedRequest extends Request {
    user?: AuthUserT;
}

export const isAuthorized = (allowedRoles: UserRoleEnum[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userRole = req.user?.data.role;

        if (userRole && allowedRoles.includes(userRole as UserRoleEnum)) {
            return next(); // User has one of the allowed roles, proceed.
        }

        return handleError(
            res,
            "Access denied. You do not have permission to perform this action.",
            StatusCodeEnum.FORBIDDEN,
        );
    };
};
