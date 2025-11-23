import { NextFunction, Response } from "express";
import { handleError2 } from "../service/error-handling";
import { UserRoleEnum } from "../types/enums";
import { CustomRequest } from "../types/express";
import { StatusCodes } from "http-status-codes";

export const isAuthorized = (allowedRoles: UserRoleEnum[]) => {
    return (req: CustomRequest, res: Response, next: NextFunction) => {
        const userRole = req.user?.data.role;

        if (userRole && allowedRoles.includes(userRole as UserRoleEnum)) {
            return next(); // User has one of the allowed roles, proceed.
        }

        return handleError2(
            res,
            "Access denied. You do not have permission to perform this action.",
            StatusCodes.FORBIDDEN,
        );
    };
};
