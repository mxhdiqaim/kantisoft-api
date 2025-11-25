/* eslint-disable @typescript-eslint/no-explicit-any */
import {and, desc, eq, inArray, ne, or} from "drizzle-orm";
import {Request, Response} from "express";
import db from "../db";
import {menuItems} from "../schema/menu-items-schema";
import {generateUniqueItemCode} from "../utils/generate-unique-item-code";
import {handleError2} from "../service/error-handling";
import {CustomRequest} from "../types/express";
import {logActivity} from "../service/activity-logger";
import {StatusCodes} from "http-status-codes";
import {stores} from "../schema/stores-schema";

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

        // Find the user's store to determine if it's a main store or a branch
        const currentStore = await db.query.stores.findFirst({
            where: eq(stores.id, storeId),
            columns: { id: true, storeParentId: true },
        });

        if (!currentStore) {
            return handleError2(
                res,
                "Associated store not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Determine the main store ID
        const mainStoreId = currentStore.storeParentId || currentStore.id;

        // Get the IDs of the main store and all its branches
        const relatedStores = await db.query.stores.findMany({
            where: or(
                eq(stores.id, mainStoreId),
                eq(stores.storeParentId, mainStoreId),
            ),
            columns: { id: true },
        });

        const storeIds = relatedStores.map((store) => store.id);

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

        // const userStoreId = req.userStoreId; // Get storeId from middleware

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view menu items.",
                StatusCodes.FORBIDDEN,
            );
        }

        const allMenuItems = await db.query.menuItems.findMany({
            where: eq(menuItems.storeId, storeId), // Always filter by storeId
            orderBy: [desc(menuItems.createdAt)],
            with: { store: { columns: { name: true } } },
        });

        res.status(StatusCodes.OK).json(allMenuItems);
    } catch (error) {
        // console.error(error);
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

        const { id } = req.params;
        // const userStoreId = req.userStoreId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view menu items.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Managers and Admins can view any item within their store.
        // Users and Guests can also view items within their store.
        const whereClause = and(
            eq(menuItems.id, id),
            eq(menuItems.storeId, storeId), // CRITICAL: Always filter by user's storeId
        );

        const menuItem = await db.query.menuItems.findFirst({
            where: whereClause,
        });

        if (!menuItem) {
            return handleError2(
                res,
                "Menu item not found",
                StatusCodes.NOT_FOUND,
            );
        }

        res.status(StatusCodes.OK).json(menuItem);
    } catch (error) {
        // console.error(error);
        return handleError2(
            res,
            "Problem loading menu item, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

// Create a new menu item
export const createMenuItem = async (req: Request, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

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
        } = req.body;

        // Validate required fields early
        if (!name || price === undefined) {
            return handleError2(
                res,
                "Name and price are required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const existingItemByName = await db
            .select()
            .from(menuItems)
            .where(
                and(
                    eq(menuItems.name, name),
                    eq(menuItems.storeId, storeId), // Filter by current user's storeId
                ),
            )
            .limit(1);

        if (existingItemByName.length > 0) {
            return handleError2(
                res,
                "Name already exists. Please edit the menu item rather than creating a new one.",
                StatusCodes.CONFLICT,
            );
        }

        let finalItemCode: string;

        if (providedItemCode) {
            const existingItem = await db
                .select()
                .from(menuItems)
                .where(
                    and(
                        eq(menuItems.itemCode, providedItemCode),
                        eq(menuItems.storeId, storeId),
                    ),
                )
                .limit(1);

            if (existingItem.length > 0) {
                return handleError2(
                    res,
                    `Item code '${providedItemCode}' is already in use. Please provide a different one or leave it blank to auto-generate.`,
                    StatusCodes.CONFLICT,
                );
            }

            finalItemCode = providedItemCode;
        } else {
            // If no itemCode is provided, auto-generate a unique one
            // This `generateUniqueItemCode` function should ideally ensure uniqueness globally or per store.
            // It supposes to be unique globally and humanly readably. I will come back for it later.
            finalItemCode = await generateUniqueItemCode(); // Assuming this is robust
        }

        const [newItem] = await db
            .insert(menuItems)
            .values({
                name,
                itemCode: finalItemCode,
                price: String(price),
                isAvailable: isAvailable ?? true,
                storeId,
            })
            .returning();

        // Log activity for menu item creation
        await logActivity({
            userId: req.user?.data.id,
            storeId: storeId,
            action: "MENU_ITEM_CREATED",
            entityId: newItem.id,
            entityType: "menuItem",
            details: `Menu item "${newItem.name}" created by ${req.user?.data.firstName} ${req.user?.data.lastName}.`,
        });

        res.status(StatusCodes.CREATED).json(newItem);
    } catch (error: any) {
        // console.error(error);
        // *** Improved error handling for database unique constraint violations ***
        if (error.cause && error.cause.code === "23505") {
            // PostgreSQL unique violation error code
            if (error.cause.constraint === "menuItems_name_store_unique") {
                return handleError2(
                    res,
                    "A menu item with this name already exists in your store.",
                    StatusCodes.CONFLICT,
                    error instanceof Error ? error : undefined,
                );
            }
            if (error.cause.constraint === "menuItems_itemCode_store_unique") {
                return handleError2(
                    res,
                    "A menu item with this item code already exists in your store.",
                    StatusCodes.CONFLICT,
                    error instanceof Error ? error : undefined,
                );
            }
            // If itemCode was globally unique and caused an error
            if (error.cause.constraint === "menuItems_itemCode_unique") {
                return handleError2(
                    res,
                    "A menu item with this item code already exists globally. Please provide a different one.",
                    StatusCodes.CONFLICT,
                    error instanceof Error ? error : undefined,
                );
            }
        }

        handleError2(
            res,
            "Problem creating menu items, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
        );
    }
};

// Update a menu item
export const updateMenuItem = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "Store ID not found for the authenticated user.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { id } = req.params;
        const { name, price, isAvailable, itemCode } = req.body;

        // CRITICAL: Fetch the item, making sure it belongs to the current user's store.
        const findWhereClause = and(
            eq(menuItems.id, id),
            eq(menuItems.storeId, storeId),
        );

        // First, get the current state of the menu item
        const currentItem = await db.query.menuItems.findFirst({
            where: findWhereClause,
        });

        if (!currentItem) {
            return handleError2(
                res,
                "Menu item not found",
                StatusCodes.NOT_FOUND,
            );
        }

        const updateData: {
            name?: string;
            price?: string;
            isAvailable?: boolean;
            itemCode?: string;
            lastModified?: Date;
        } = {};

        if (name !== undefined) {
            // CRITICAL: Check for uniqueness of the updated name within the store
            if (name !== currentItem.name) {
                const existingItemWithName = await db.query.menuItems.findFirst(
                    {
                        where: and(
                            eq(menuItems.name, name),
                            eq(menuItems.storeId, storeId),
                            ne(menuItems.id, id), // Exclude the current item
                        ),
                    },
                );
                if (existingItemWithName) {
                    return handleError2(
                        res,
                        `An item with the name '${name}' already exists in your store.`,
                        StatusCodes.CONFLICT,
                    );
                }
            }
            updateData.name = name;
        }

        if (price !== undefined) updateData.price = String(price);
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        // If an item code is provided, use it.
        if (itemCode !== undefined) {
            // CRITICAL: Check for uniqueness of updated itemCode within the store
            if (itemCode !== currentItem.itemCode) {
                const existingItemWithCode = await db.query.menuItems.findFirst(
                    {
                        where: and(
                            eq(menuItems.itemCode, itemCode),
                            eq(menuItems.storeId, storeId),
                            ne(menuItems.id, id),
                        ),
                    },
                );
                if (existingItemWithCode) {
                    return handleError2(
                        res,
                        `Item code '${itemCode}' is already in use by another item, create another one or leave it blank to auto-generate.`,
                        StatusCodes.CONFLICT,
                    );
                }
            }
            updateData.itemCode = itemCode;
        } else if (!currentItem.itemCode) {
            // If no item code is provided AND the item doesn't have one, generate it.
            updateData.itemCode = await generateUniqueItemCode();
        }

        updateData.lastModified = new Date();

        if (Object.keys(updateData).length === 0) {
            return handleError2(
                res,
                "No valid fields provided for update.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const updatedItem = await db
            .update(menuItems)
            .set(updateData)
            .where(findWhereClause)
            .returning();

        if (updatedItem.length === 0) {
            return handleError2(
                res,
                "Menu item not found or no changes made.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Log activity for menu item update
        await logActivity({
            userId: req.user?.data.id,
            storeId: storeId,
            action: "MENU_ITEM_UPDATED",
            entityId: updatedItem[0].id,
            entityType: "menuItem",
            details: `Menu item "${updatedItem[0].name}" updated by ${req.user?.data.firstName} ${req.user?.data.lastName}.`,
        });

        res.status(StatusCodes.OK).json(updatedItem[0]);
    } catch (error) {
        // Handle potential unique constraint errors, e.g. if the new name is already taken
        console.error(error);
        handleError2(
            res,
            "The provided name or item code is already in use.",
            StatusCodes.CONFLICT,
            error instanceof Error ? error : undefined,
        );
    }
};

// Delete a menu item
export const deleteMenuItem = async (req: Request, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        const { id } = req.params;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to delete menu items.",
                StatusCodes.FORBIDDEN,
            );
        }

        // CRITICAL: Ensure the item being deleted belongs to the user's store
        const whereClause = and(
            eq(menuItems.id, id),
            eq(menuItems.storeId, storeId),
        );

        // if (!isManager && userStoreId) {
        //     whereClause = and(whereClause, eq(menuItems.storeId, userStoreId));
        // }

        const deletedItem = await db
            .delete(menuItems)
            .where(whereClause)
            .returning();

        if (deletedItem.length === 0) {
            return res
                .status(StatusCodes.NOT_FOUND)
                .json({ message: "Menu item not found" });
        }

        // Log activity for menu item deletion
        await logActivity({
            userId: req.user?.data.id,
            storeId: storeId,
            action: "MENU_ITEM_DELETED",
            entityId: deletedItem[0].id,
            entityType: "menuItem",
            details: `Menu item "${deletedItem[0].name}" deleted by ${req.user?.data.firstName} ${req.user?.data.lastName}.`,
        });

        res.status(StatusCodes.OK).json({
            message: "Menu item deleted successfully",
        });
    } catch (error) {
        // console.error(error);
        return handleError2(
            res,
            "Problem deleting menu items, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};
