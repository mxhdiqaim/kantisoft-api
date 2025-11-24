import { Request, Response } from "express";
import db from "../db";
import { stores, StoreType } from "../schema/stores-schema";
import { and, eq, or } from "drizzle-orm";
import { handleError, handleError2 } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";
import { logActivity } from "../service/activity-logger";
import { StatusCodes } from "http-status-codes";

export const getAllStores = async (req: Request, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "Authenticated User is not associated with any store.",
                StatusCodes.FORBIDDEN,
            );
        }
        const mainStoreData = await db.query.stores.findFirst({
            // Optionally, you could filter for only top-level stores (not branches)
            where: eq(stores.id, String(storeId)),
            with: {
                branches: true, // Include all child stores (branches)
            },
        });

        if (!mainStoreData) {
            return res.status(StatusCodes.OK).json([]);
        }

        const { branches = [], ...mainStore } = mainStoreData;

        const formattedStores = [
            { ...mainStore, branchType: "main" },
            ...branches.map((branch: StoreType) => ({
                ...branch,
                branchType: "branch",
            })),
        ];

        // // Log activity for viewing a store
        // await logActivity({
        //     userId: currentUser.id,
        //     storeId: String(storeId),
        //     action: "STORES_VIEWED",
        //     details: `All stores viewed by ${currentUser.firstName} ${currentUser.lastName}.`,
        // });
        res.status(StatusCodes.OK).json(formattedStores);
    } catch (error) {
        // console.log("error", error);
        handleError2(
            res,
            "Failed to fetch stores.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

export const getStoreById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const currentUser = req.user?.data;
        const userStoreId = currentUser?.storeId;

        if (!userStoreId) {
            return handleError2(
                res,
                "Authentication required.",
                StatusCodes.UNAUTHORIZED,
            );
        }

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return handleError2(
                res,
                "Invalid store ID format.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const store = await db.query.stores.findFirst({
            where: or(eq(stores.id, id), eq(stores.storeParentId, id)),
            with: {
                parent: true, // Include the parent store if it exists
                branches: true, // Include all child stores (branches)
            },
        });
        if (!store) {
            return handleError2(res, "Store not found.", StatusCodes.NOT_FOUND);
        }

        // IMPORTANT: Authorisation check
        // The requested store must either be the user's store OR a branch of it
        if (store.id !== userStoreId && store.storeParentId !== userStoreId) {
            return handleError2(
                res,
                "You do not have permission to view this store.",
                StatusCodes.FORBIDDEN,
            );
        }

        // // Log activity for viewing a store
        // await logActivity({
        //     userId: currentUser.id,
        //     storeId: userStoreId,
        //     action: "STORE_VIEWED",
        //     entityId: store.id,
        //     entityType: "store",
        //     details: `Store "${store.name}" viewed by ${currentUser.firstName} ${currentUser.lastName}.`,
        // });

        res.status(StatusCodes.OK).json(store);
    } catch (error) {
        // console.log("error", error);
        handleError2(
            res,
            "Failed to fetch store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

export const createStore = async (req: Request, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        // A manager can only create a branch for their own store.
        if (!storeId) {
            return handleError2(
                res,
                "You must belong to a store to create a branch.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { name, location, storeType } = req.body;

        // Assign the new store's parentId to be the current user's storeId
        const storeParentId = storeId;

        const [newStore] = await db
            .insert(stores)
            .values({ name, location, storeType, storeParentId })
            .returning();

        // Log activity for store creation
        await logActivity({
            userId: currentUser.id,
            storeId: storeParentId,
            action: "STORE_CREATED",
            entityId: newStore.id,
            entityType: "store",
            details: `Store "${newStore.name}" created by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.CREATED).json(newStore);
    } catch (error) {
        // console.log("error", error);
        handleError2(
            res,
            "Failed to create store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
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
            return handleError2(
                res,
                "Authentication required.",
                StatusCodes.UNAUTHORIZED,
            );
        }

        // Authorisation: Check if the store to be updated belongs to the user
        // A manager can update their own store or a branch of their store.
        const storeToUpdate = await db.query.stores.findFirst({
            where: or(eq(stores.id, id), eq(stores.storeParentId, userStoreId)),
        });

        if (!storeToUpdate) {
            return handleError2(
                res,
                "Store not found or you do not have permission to update it.",
                StatusCodes.FORBIDDEN,
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
            return handleError2(
                res,
                "Failed to update store.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Log activity for store update
        await logActivity({
            userId: currentUser.id,
            storeId: userStoreId,
            action: "STORE_UPDATED",
            entityId: updatedStore.id,
            entityType: "store",
            details: `Store "${updatedStore.name}" updated by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.OK).json(updatedStore);
    } catch (error) {
        console.log("error", error);
        handleError2(
            res,
            "Failed to update store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
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

        // Authorisation: Check if the store to be deleted belongs to the user
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

        // Log activity for store deletion
        await logActivity({
            userId: currentUser.id,
            storeId: userStoreId,
            action: "STORE_DELETED",
            entityId: deletedStore.id,
            entityType: "store",
            details: `Store "${deletedStore.name}" deleted by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

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
