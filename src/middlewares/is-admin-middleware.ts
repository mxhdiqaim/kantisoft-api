import { NextFunction, Response } from "express";
import { handleError2 } from "../service/error-handling";
import { UserRoleEnum } from "../types/enums";

import { CustomRequest } from "../types/express";
import { StatusCodes } from "http-status-codes";

export const isAdmin = (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
) => {
    // Assumes a previous middleware has authenticated the user and attached user info to req.user
    if (
        req.user &&
        req.user.data &&
        req.user.data.role === UserRoleEnum.ADMIN
    ) {
        return next();
    }
    return handleError2(
        res,
        "Access denied. You do not have permission to perform this action.",
        StatusCodes.FORBIDDEN,
    );
};
