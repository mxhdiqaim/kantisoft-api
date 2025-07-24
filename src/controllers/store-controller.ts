import { Request, Response } from "express";
import db from "../db";
import { stores } from "../schema/stores-schema";
import { and, eq, or } from "drizzle-orm";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";

export const getAllStores = async (req: Request, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError(
                res,
                "Store ID not found for the authenticated user.",
                StatusCodeEnum.FORBIDDEN,
            );
        }
        const allStores = await db.query.stores.findMany({
            // Optionally, you could filter for only top-level stores (not branches)
            where: or(
                eq(stores.id, String(storeId)),
                eq(stores.storeParentId, String(storeId)),
            ),
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
        const currentUser = req.user?.data;
        const userStoreId = currentUser?.storeId;

        if (!userStoreId) {
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        const store = await db.query.stores.findFirst({
            where: or(eq(stores.id, id), eq(stores.storeParentId, id)),
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

        // IMPORTANT: Authorization check
        // The requested store must either be the user's store OR a branch of it
        if (store.id !== userStoreId && store.storeParentId !== userStoreId) {
            return handleError(
                res,
                "You do not have permission to view this store.",
                StatusCodeEnum.FORBIDDEN,
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
        const { name, location, storeType } = req.body;
        const currentUser = req.user?.data;

        // A manager can only create a branch for their own store.
        if (!currentUser?.storeId) {
            return handleError(
                res,
                "You must belong to a store to create a branch.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // Assign the new store's parentId to be the current user's storeId
        const storeParentId = currentUser.storeId;

        // const newStore = await db.transaction(async (tx) => {
        //     // Create the new store
        //     const [insertedStore] = await tx
        //         .insert(stores)
        //         .values({ name, location, storeType, storeParentId })
        //         .returning();

        //     // If the creator is a manager without a store, assign them to this new store.
        //     if (currentUser && !currentUser.storeId) {
        //         await tx
        //             .update(users)
        //             .set({ storeId: insertedStore.id })
        //             .where(eq(users.id, currentUser.id));
        //     }

        //     return insertedStore;
        // });

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
        const currentUser = req.user?.data;
        const userStoreId = currentUser?.storeId;

        // Authenticated and store owner check
        if (!userStoreId) {
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Authorization: Check if the store to be updated belongs to the user
        // A manager can update their own store or a branch of their store.
        const storeToUpdate = await db.query.stores.findFirst({
            where: or(eq(stores.id, id), eq(stores.storeParentId, userStoreId)),
        });

        if (!storeToUpdate) {
            return handleError(
                res,
                "Store not found or you do not have permission to update it.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        const [updatedStore] = await db
            .update(stores)
            .set({ name, location, storeType, storeParentId })
            // We use 'and' to ensure the ID matches and the store belongs to the user
            .where(
                and(
                    eq(stores.id, id),
                    or(
                        eq(stores.id, userStoreId),
                        eq(stores.storeParentId, userStoreId),
                    ),
                ),
            )
            .returning();

        if (!updatedStore) {
            return handleError(
                res,
                "Failed to update store.",
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
        const currentUser = req.user?.data;
        const userStoreId = currentUser?.storeId;

        // Authenticated and store owner check
        if (!userStoreId) {
            return handleError(
                res,
                "Authentication required.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Authorization: Check if the store to be deleted belongs to the user
        const storeToDelete = await db.query.stores.findFirst({
            where: or(eq(stores.id, id), eq(stores.storeParentId, userStoreId)),
        });

        if (!storeToDelete) {
            return handleError(
                res,
                "Store not found or you do not have permission to delete it.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // 3. Business Logic: Prevent deleting a store that has branches
        const hasBranches = await db.query.stores.findFirst({
            where: eq(stores.storeParentId, id),
        });

        if (hasBranches) {
            return handleError(
                res,
                "Cannot delete a store that has active branches.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        // Perform the deletion
        const [deletedStore] = await db
            .delete(stores)
            .where(
                and(
                    eq(stores.id, id),
                    or(
                        eq(stores.id, userStoreId),
                        eq(stores.storeParentId, userStoreId),
                    ),
                ),
            )
            .returning();

        if (!deletedStore) {
            return handleError(
                res,
                "Failed to delete store. It might have been already deleted.",
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
