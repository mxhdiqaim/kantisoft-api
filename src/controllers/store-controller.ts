import { Response } from "express";
import db from "../db";
import { stores } from "../schema/stores-schema";
import { and, count, eq, inArray } from "drizzle-orm";
import { handleError2 } from "../service/error-handling";
import { UserRoleEnum } from "../types/enums";
import { logActivity } from "../service/activity-logger";
import { StatusCodes } from "http-status-codes";
import { CustomRequest } from "../types/express";
import { getStoreAndBranchIds } from "../service/store-service";

/**
 * @desc    Get all stores with role-based access and pagination.
 * @route   GET /api/v1/stores
 * @access  Private (Manager, Admin, User, Guest)
 * @query   page {number} - The page number for pagination.
 * @query   limit {number} - The number of items per page.
 */
export const getAllStores = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;
        const { page = '1', limit = '10' } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const offset = (pageNumber - 1) * limitNumber;

        if (!storeId) {
            return handleError2(
                res,
                "Authenticated User is not associated with any store.",
                StatusCodes.FORBIDDEN,
            );
        }

        let whereClause;

        if (userRole === UserRoleEnum.MANAGER) {
            const managedStoreIds = await getStoreAndBranchIds(storeId);
            if (!managedStoreIds) {
                return handleError2(res, "Could not find managed stores.", StatusCodes.NOT_FOUND);
            }
            whereClause = inArray(stores.id, managedStoreIds);
        } else {
            whereClause = eq(stores.id, storeId);
        }

        const [totalItemsResult] = await db.select({ value: count() }).from(stores).where(whereClause);
        const totalItems = totalItemsResult.value;

        const allStores = await db.query.stores.findMany({
            where: whereClause,
            limit: limitNumber,
            offset: offset,
        });

        const storesWithBranchType = allStores.map(store => ({
            ...store,
            branchType: store.storeParentId ? 'branch' : 'main',
        }));

        res.status(StatusCodes.OK).json({
            data: storesWithBranchType,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / limitNumber),
                currentPage: pageNumber,
                pageSize: limitNumber,
            },
        });
    } catch (error) {
        handleError2(
            res,
            "Failed to fetch stores.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Get a single store by its ID.
 * @route   GET /api/v1/stores/:id
 * @access  Private (Manager, Admin, User, Guest - within their accessible stores)
 */
export const getStoreById = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;

        if (!storeId) {
            return handleError2(res, "Authentication required.", StatusCodes.UNAUTHORIZED);
        }

        let whereClause;

        if (userRole === UserRoleEnum.MANAGER) {
            const managedStoreIds = await getStoreAndBranchIds(storeId);
            if (!managedStoreIds) {
                return handleError2(res, "Could not find managed stores.", StatusCodes.NOT_FOUND);
            }
            whereClause = and(eq(stores.id, id), inArray(stores.id, managedStoreIds));
        } else {
            whereClause = and(eq(stores.id, id), eq(stores.id, storeId));
        }

        const store = await db.query.stores.findFirst({
            where: whereClause,
            with: {
                parent: true,
                branches: true,
            },
        });

        if (!store) {
            return handleError2(res, "Store not found or you do not have permission to view it.", StatusCodes.NOT_FOUND);
        }

        const responseStore = {
            ...store,
            branchType: store.storeParentId ? 'branch' : 'main',
            branches: store.branches?.map(branch => ({
                ...branch,
                branchType: 'branch',
            })),
        };

        res.status(StatusCodes.OK).json(responseStore);
    } catch (error) {
        handleError2(
            res,
            "Failed to fetch store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Create a new store (branch).
 * @route   POST /api/v1/stores
 * @access  Private (Manager only)
 * @body    name {string} - The name of the new store.
 * @body    location {string} - [Optional] The location of the new store.
 * @body    storeType {string} - The type of the new store (e.g., 'RESTAURANT').
 */
export const createStore = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;

        if (!storeId) {
            return handleError2(res, "You must belong to a main store to create a branch.", StatusCodes.FORBIDDEN);
        }

        if (userRole !== UserRoleEnum.MANAGER) {
            return handleError2(res, "You can complete this action.", StatusCodes.FORBIDDEN);
        }

        const { name, location, storeType } = req.body;

        if (!name || !storeType) {
            return handleError2(res, "Store name and type are required.", StatusCodes.BAD_REQUEST);
        }

        const storeParentId = storeId;

        const [newStore] = await db
            .insert(stores)
            .values({ name, location, storeType, storeParentId })
            .returning();

        await logActivity({
            userId: currentUser.id,
            storeId: storeId,
            action: "STORE_CREATED",
            entityId: newStore.id,
            entityType: "store",
            details: `Store (branch) "${newStore.name}" created by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.CREATED).json({
            ...newStore,
            branchType: 'branch',
        });
    } catch (error) {
        handleError2(
            res,
            "Failed to create store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Update an existing store.
 * @route   PATCH /api/v1/stores/:id
 * @access  Private (Manager only)
 * @param   id {string} - The ID of the store to update.
 * @body    name {string} - [Optional] The new name of the store.
 * @body    location {string} - [Optional] The new location of the store.
 * @body    storeType {string} - [Optional] The new type of the store.
 */
export const updateStore = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(res, "Authentication required.", StatusCodes.UNAUTHORIZED);
        }

        const userRole = currentUser?.role;

        if (userRole !== UserRoleEnum.MANAGER) {
            return handleError2(res, "Only managers can update stores.", StatusCodes.FORBIDDEN);
        }

        const managedStoreIds = await getStoreAndBranchIds(storeId);

        const { id } = req.params;

        if (!managedStoreIds || !managedStoreIds.includes(id)) {
            return handleError2(res, "Store not found or you do not have permission to update it.", StatusCodes.FORBIDDEN);
        }

        const updateData = req.body;

        delete updateData.id;
        delete updateData.storeParentId;

        if (Object.keys(updateData).length === 0) {
            return handleError2(res, "No fields provided for update.", StatusCodes.BAD_REQUEST);
        }

        const [updatedStore] = await db
            .update(stores)
            .set(updateData)
            .where(eq(stores.id, id))
            .returning();

        if (!updatedStore) {
            return handleError2(res, "Failed to update store or store not found.", StatusCodes.NOT_FOUND);
        }

        await logActivity({
            userId: currentUser.id,
            storeId: storeId,
            action: "STORE_UPDATED",
            entityId: updatedStore.id,
            entityType: "store",
            details: `Store "${updatedStore.name}" updated by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.OK).json({
            ...updatedStore,
            branchType: updatedStore.storeParentId ? 'branch' : 'main',
        });
    } catch (error) {
        handleError2(
            res,
            "Failed to update store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Delete a store.
 * @route   DELETE /api/v1/stores/:id
 * @access  Private (Manager only)
 * @param   id {string} - The ID of the store to delete.
 */
export const deleteStore = async (req: CustomRequest, res: Response) => {
    try {
        const { id: targetStoreId } = req.params;
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;

        if (userRole !== UserRoleEnum.MANAGER) {
            return handleError2(res, "Only managers can delete stores.", StatusCodes.FORBIDDEN);
        }

        if (!storeId) {
            return handleError2(res, "Authentication required.", StatusCodes.UNAUTHORIZED);
        }

        if (targetStoreId === storeId) {
            return handleError2(res, "Cannot delete your own main store.", StatusCodes.BAD_REQUEST);
        }

        const managedStoreIds = await getStoreAndBranchIds(storeId);
        if (!managedStoreIds || !managedStoreIds.includes(targetStoreId)) {
            return handleError2(res, "Store not found or you do not have permission to delete it.", StatusCodes.FORBIDDEN);
        }

        const hasBranches = await db.query.stores.findFirst({
            where: eq(stores.storeParentId, targetStoreId),
        });

        if (hasBranches) {
            return handleError2(res, "Cannot delete a store that has active branches.", StatusCodes.BAD_REQUEST);
        }

        const [deletedStore] = await db.delete(stores).where(eq(stores.id, targetStoreId)).returning();

        if (!deletedStore) {
            return handleError2(res, "Failed to delete store. It might have been already deleted.", StatusCodes.NOT_FOUND);
        }

        await logActivity({
            userId: currentUser.id,
            storeId: storeId,
            action: "STORE_DELETED",
            entityId: deletedStore.id,
            entityType: "store",
            details: `Store "${deletedStore.name}" deleted by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.OK).json({ message: "Store deleted successfully." });
    } catch (error) {
        handleError2(
            res,
            "Failed to delete store.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};
