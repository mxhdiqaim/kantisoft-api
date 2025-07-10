import { NextFunction, Request, Response } from "express";

const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    res.status(403).json({message: "You are not allowed to perform this action"});
};

/**
 * Middleware to check if the user is an authenticated admin
 */
const authorityCheck = (req: Request, res: Response, next: NextFunction) => {
    // const formRoute = "/form";
    const openRoutes: string[] = ["/users/login"]; // Routes to exclude from authorisation

    if (openRoutes.some((route) => req.path.startsWith(route)) || req.path.match(/^\/check\/\d+/)) {
        return next();
    }

    return authorizeAdmin(req, res, next);
};

export default authorityCheck;
