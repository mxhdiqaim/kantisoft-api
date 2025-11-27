import { Request } from "express";
import { AuthUserT } from "../config/auth-config";

// Declare a module 'express' to augment its interfaces
declare module "express" {
    interface Request {
        // This explicitly declares that `req.user` will be of type `AuthUserT`.
        // Which is already set globally in the auth-config.ts file
        // including it here can centralise the custom request properties.
        user?: AuthUserT;

        // // This types the custom `userStoreId` property that middleware
        // // (like `checkUserHasStore`) is expecting to add to the request object.
        // userStoreId?: string;

        storeIds?: string[];
    }
}

export interface CustomRequest extends Request {
    user?: AuthUserT;
    // userStoreId?: string;
    storeIds?: string[];
}
