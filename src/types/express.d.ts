import { Request } from "express";
import { AuthUserT } from "../config/auth-config";

// Declare module 'express' to augment its interfaces
declare module "express" {
    interface Request {
        // This explicitly declares that `req.user` will be of type `AuthUserT`.
        // auth-config.ts file already sets this globally,
        // including it here can centralize the custom request properties.
        user?: AuthUserT;

        // This types the custom `userStoreId` property that a middleware
        // (like `checkStoreAccess`) is expecting to add to the request object.
        userStoreId?: string;
    }
}

export interface CustomRequest extends Request {
    user?: AuthUserT;
    userStoreId?: string;
}
