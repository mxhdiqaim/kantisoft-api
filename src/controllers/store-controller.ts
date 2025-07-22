import { Request, Response } from "express";
import db from "../db";
import { stores } from "../schema/stores-schema";
import { eq } from "drizzle-orm";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";

export const getAllStores = async (req: Request, res: Response) => {
    try {
        // const allStores = await db.select().from(stores);
        // Using db.query allows us to fetch relations easily
        const allStores = await db.query.stores.findMany({
            // Optionally, you could filter for only top-level stores (not branches)
            // where: isNull(stores.parentId),
            with: {
                branches: true, // Include all child stores (branches)
            },
        });
        res.status(StatusCodeEnum.OK).json(allStores);
    } catch (error) {
        console.log("error", error);
        handleError(
            res,
            "Failed to fetch stores.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

export const getStoreById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // const [store] = await db.select().from(stores).where(eq(stores.id, id));
        const store = await db.query.stores.findFirst({
            where: eq(stores.id, id),
            with: {
                parent: true, // Include the parent store, if it exists
                branches: true, // Include all child stores (branches)
            },
        });
        if (!store) {
            return handleError(
                res,
                "Store not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }
        res.status(StatusCodeEnum.OK).json(store);
    } catch (error) {
        console.log("error", error);
        handleError(
            res,
            "Failed to fetch store.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

export const createStore = async (req: Request, res: Response) => {
    try {
        const { name, location, storeType, storeParentId } = req.body;
        const [newStore] = await db
            .insert(stores)
            .values({ name, location, storeType, storeParentId })
            .returning();
        res.status(StatusCodeEnum.CREATED).json(newStore);
    } catch (error) {
        console.log("error", error);
        handleError(
            res,
            "Failed to create store.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

export const updateStore = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, location, storeType, storeParentId } = req.body;
        const [updatedStore] = await db
            .update(stores)
            .set({ name, location, storeType, storeParentId })
            .where(eq(stores.id, id))
            .returning();
        if (!updatedStore) {
            return handleError(
                res,
                "Store not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }
        res.status(StatusCodeEnum.OK).json(updatedStore);
    } catch (error) {
        console.log("error", error);
        handleError(
            res,
            "Failed to update store.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

export const deleteStore = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const [deletedStore] = await db
            .delete(stores)
            .where(eq(stores.id, id))
            .returning();
        if (!deletedStore) {
            return handleError(
                res,
                "Store not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }
        res.status(StatusCodeEnum.OK).json({
            message: "Store deleted successfully.",
        });
    } catch (error) {
        console.log("error", error);
        handleError(
            res,
            "Failed to delete store.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
