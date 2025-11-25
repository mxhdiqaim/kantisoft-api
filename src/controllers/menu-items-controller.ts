/* eslint-disable @typescript-eslint/no-explicit-any */
import {and, desc, eq, inArray, ne} from "drizzle-orm";
import {Response} from "express";
import db from "../db";
import {menuItems} from "../schema/menu-items-schema";
import {generateUniqueItemCode} from "../utils/generate-unique-item-code";
import {handleError2} from "../service/error-handling";
import {CustomRequest} from "../types/express";
import {logActivity} from "../service/activity-logger";
import {StatusCodes} from "http-status-codes";
import {UserRoleEnum} from "../types/enums";
import {getStoreAndBranchIds} from "../service/store-service";

// Get all menu items from the main store and its branches
export const getAllMenuItemsFromStoreAndBranches = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view menu items.",
                StatusCodes.FORBIDDEN,
            );
        }

        const storeIds = await getStoreAndBranchIds(storeId);

        if (!storeIds) {
            return handleError2(
                res,
                "Associated store not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        if (storeIds.length === 0) {
            return res.status(StatusCodes.OK).json([]);
        }

        // Fetch all menu items from the collected store IDs
        const allMenuItems = await db.query.menuItems.findMany({
            where: inArray(menuItems.storeId, storeIds),
            orderBy: [desc(menuItems.createdAt)],
            with: { store: { columns: { name: true } } },
        });

        res.status(StatusCodes.OK).json(allMenuItems);
    } catch (error) {
        // console.error(error);
        handleError2(
            res,
            "Problem loading menu items from store and branches, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

// Get all menu items
export const getAllMenuItems = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view menu items.",
                StatusCodes.FORBIDDEN,
            );
        }

        let whereClause;

        if (userRole === UserRoleEnum.MANAGER) {
            const storeIds = await getStoreAndBranchIds(storeId);
            if (!storeIds) {
                return handleError2(
                    res,
                    "Associated store not found.",
                    StatusCodes.NOT_FOUND,
                );
            }
            whereClause = inArray(menuItems.storeId, storeIds);
        } else {
            whereClause = eq(menuItems.storeId, storeId);
        }

        const allMenuItems = await db.query.menuItems.findMany({
            where: whereClause,
            orderBy: [desc(menuItems.createdAt)],
            with: { store: { columns: { name: true } } },
        });

        res.status(StatusCodes.OK).json(allMenuItems);
    } catch (error) {
        handleError2(
            res,
            "Problem loading menu items, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

// Get a single menu item by ID
export const getMenuItemById = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;
        const { id } = req.params;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view menu items.",
                StatusCodes.FORBIDDEN,
            );
        }

        let whereClause;

        if (userRole === UserRoleEnum.MANAGER) {
            const storeIds = await getStoreAndBranchIds(storeId);
            if (!storeIds) {
                return handleError2(
                    res,
                    "Associated store not found.",
                    StatusCodes.NOT_FOUND,
                );
            }
            whereClause = and(
                eq(menuItems.id, id),
                inArray(menuItems.storeId, storeIds),
            );
        } else {
            whereClause = and(
                eq(menuItems.id, id),
                eq(menuItems.storeId, storeId),
            );
        }

        const menuItem = await db.query.menuItems.findFirst({
            where: whereClause,
        });

        if (!menuItem) {
            return handleError2(
                res,
                "Menu item not found or you do not have permission to view it.",
                StatusCodes.NOT_FOUND,
            );
        }

        res.status(StatusCodes.OK).json(menuItem);
    } catch (error) {
        return handleError2(
            res,
            "Problem loading menu item, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

// Create a new menu item
export const createMenuItem = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;

        if (!storeId) {
            return handleError2(
                res,
                "Store ID not found for the authenticated user.",
                StatusCodes.FORBIDDEN,
            );
        }

        const {
            name,
            price,
            isAvailable,
            itemCode: providedItemCode,
            storeId: targetStoreId, // For managers to specify a store
        } = req.body;

        let finalStoreId = storeId;

        if (userRole === UserRoleEnum.MANAGER) {
            if (targetStoreId) {
                const storeIds = await getStoreAndBranchIds(storeId);
                if (!storeIds?.includes(targetStoreId)) {
                    return handleError2(
                        res,
                        "You do not have permission to create items in this store.",
                        StatusCodes.FORBIDDEN,
                    );
                }
                finalStoreId = targetStoreId;
            }
        }

        if (!name || price === undefined) {
            return handleError2(
                res,
                "Name and price are required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const existingItemByName = await db.query.menuItems.findFirst({
            where: and(
                eq(menuItems.name, name),
                eq(menuItems.storeId, finalStoreId),
            ),
        });

        if (existingItemByName) {
            return handleError2(
                res,
                "Name already exists in this store. Please edit the menu item instead.",
                StatusCodes.CONFLICT,
            );
        }

        let finalItemCode: string;
        if (providedItemCode) {
            const existingItem = await db.query.menuItems.findFirst({
                where: and(
                    eq(menuItems.itemCode, providedItemCode),
                    eq(menuItems.storeId, finalStoreId),
                ),
            });

            if (existingItem) {
                return handleError2(
                    res,
                    `Item code '${providedItemCode}' is already in use in this store. Leave blank to auto-generate a unique code.`,
                    StatusCodes.CONFLICT,
                );
            }
            finalItemCode = providedItemCode;
        } else {
            finalItemCode = await generateUniqueItemCode();
        }

        const [newItem] = await db
            .insert(menuItems)
            .values({
                name,
                itemCode: finalItemCode,
                price: String(price),
                isAvailable: isAvailable ?? true,
                storeId: finalStoreId,
            })
            .returning();

        await logActivity({
            userId: currentUser.id,
            storeId: finalStoreId,
            action: "MENU_ITEM_CREATED",
            entityId: newItem.id,
            entityType: "menuItem",
            details: `Menu item "${newItem.name}" created by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.CREATED).json(newItem);
    } catch (error: any) {
        if (error.cause?.code === "23505") {
            return handleError2(
                res,
                "A menu item with this name or item code already exists in the target store.",
                StatusCodes.CONFLICT,
                error instanceof Error ? error : undefined,
            );
        }
        handleError2(
            res,
            "Problem creating menu item, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

// Update a menu item
export const updateMenuItem = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;

        if (!storeId) {
            return handleError2(
                res,
                "Store ID not found for the authenticated user.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { id } = req.params;
        const { name, price, isAvailable, itemCode } = req.body;

        let findWhereClause;
        if (userRole === UserRoleEnum.MANAGER) {
            const storeIds = await getStoreAndBranchIds(storeId);
            if (!storeIds) {
                return handleError2(
                    res,
                    "Associated store not found.",
                    StatusCodes.NOT_FOUND,
                );
            }
            findWhereClause = and(
                eq(menuItems.id, id),
                inArray(menuItems.storeId, storeIds),
            );
        } else {
            findWhereClause = and(
                eq(menuItems.id, id),
                eq(menuItems.storeId, storeId),
            );
        }

        const currentItem = await db.query.menuItems.findFirst({
            where: findWhereClause,
        });

        if (!currentItem) {
            return handleError2(
                res,
                "Menu item not found or you do not have permission to edit it.",
                StatusCodes.NOT_FOUND,
            );
        }

        const updateData: { [key: string]: any } = {};

        if (name !== undefined && name !== currentItem.name) {
            if (currentItem.storeId) {
                const existing = await db.query.menuItems.findFirst({
                    where: and(
                        eq(menuItems.name, name),
                        eq(menuItems.storeId, currentItem.storeId),
                        ne(menuItems.id, id),
                    ),
                });
                if (existing) {
                    return handleError2(
                        res,
                        `An item with the name '${name}' already exists in this store.`,
                        StatusCodes.CONFLICT,
                    );
                }
            }
            updateData.name = name;
        }

        if (itemCode !== undefined && itemCode !== currentItem.itemCode) {
            if (currentItem.storeId) {
                const existing = await db.query.menuItems.findFirst({
                    where: and(
                        eq(menuItems.itemCode, itemCode),
                        eq(menuItems.storeId, currentItem.storeId),
                        ne(menuItems.id, id),
                    ),
                });
                if (existing) {
                    return handleError2(
                        res,
                        `Item code '${itemCode}' is already in use in this store.`,
                        StatusCodes.CONFLICT,
                    );
                }
            }
            updateData.itemCode = itemCode;
        }

        if (price !== undefined) updateData.price = String(price);
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        if (Object.keys(updateData).length === 0) {
            return handleError2(
                res,
                "No valid fields provided for update.",
                StatusCodes.BAD_REQUEST,
            );
        }

        updateData.lastModified = new Date();

        const [updatedItem] = await db
            .update(menuItems)
            .set(updateData)
            .where(eq(menuItems.id, id))
            .returning();

        await logActivity({
            userId: currentUser.id,
            storeId: updatedItem.storeId,
            action: "MENU_ITEM_UPDATED",
            entityId: updatedItem.id,
            entityType: "menuItem",
            details: `Menu item "${updatedItem.name}" updated by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.OK).json(updatedItem);
    } catch (error) {
        handleError2(
            res,
            "Problem updating menu item, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

// Delete a menu item
export const deleteMenuItem = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const userRole = currentUser?.role;
        const { id } = req.params;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to delete menu items.",
                StatusCodes.FORBIDDEN,
            );
        }

        let whereClause;

        if (userRole === UserRoleEnum.MANAGER) {
            const storeIds = await getStoreAndBranchIds(storeId);

            if (!storeIds) {
                return handleError2(
                    res,
                    "Associated store not found.",
                    StatusCodes.NOT_FOUND,
                );
            }

            whereClause = and(
                eq(menuItems.id, id),
                inArray(menuItems.storeId, storeIds),
            );
        } else {
            // Admin can only delete it from their own store
            whereClause = and(
                eq(menuItems.id, id),
                eq(menuItems.storeId, storeId),
            );
        }

        const deletedItem = await db
            .delete(menuItems)
            .where(whereClause)
            .returning();

        if (deletedItem.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message:
                    "Menu item not found or you don't have permission to delete it.",
            });
        }

        // Log activity for menu item deletion
        await logActivity({
            userId: currentUser.id,
            storeId: deletedItem[0].storeId, // Log with the actual store ID of the item
            action: "MENU_ITEM_DELETED",
            entityId: deletedItem[0].id,
            entityType: "menuItem",
            details: `Menu item "${deletedItem[0].name}" deleted by ${currentUser.firstName} ${currentUser.lastName}.`,
        });

        res.status(StatusCodes.OK).json({
            message: "Menu item deleted successfully",
        });
    } catch (error) {
        return handleError2(
            res,
            "Problem deleting menu item, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};
