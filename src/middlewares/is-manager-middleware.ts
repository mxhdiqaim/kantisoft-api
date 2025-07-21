import { Request, Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum, UserRoleEnum } from "../types/enums";
import { AuthUserT } from "../config/auth-config";

// This is a placeholder. You should have a custom Request type that includes your user object.
interface AuthenticatedRequest extends Request {
    user?: AuthUserT;
}

export const isManager = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    // Admins should also have access to manager routes
    if (
        req.user &&
        (req.user.data.role === UserRoleEnum.MANAGER ||
            req.user.data.role === UserRoleEnum.ADMIN)
    ) {
        return next();
    }

    return handleError(
        res,
        "Access denied. Manager or Admin role required.",
        StatusCodeEnum.FORBIDDEN,
    );
};
