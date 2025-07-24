/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, desc, eq, ne } from "drizzle-orm";
import { Request, Response } from "express";
import db from "../db";
import { menuItems } from "../schema/menu-items-schema";
import { generateUniqueItemCode } from "../utils/generate-unique-item-code";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";
import { CustomRequest } from "../types/express";

// Get all menu items
export const getAllMenuItems = async (req: CustomRequest, res: Response) => {
    try {
        const userStoreId = req.userStoreId; // Get storeId from middleware

        if (!userStoreId) {
            return handleError(
                res,
                "You must be associated with a store to view menu items.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        const allMenuItems = await db.query.menuItems.findMany({
            where: eq(menuItems.storeId, userStoreId), // Always filter by storeId
            orderBy: [desc(menuItems.createdAt)],
            with: { store: { columns: { name: true } } },
        });

        res.status(StatusCodeEnum.OK).json(allMenuItems);
    } catch (error) {
        console.error(error);
        handleError(
            res,
            "Problem loading menu items, please try again",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

// Get a single menu item by ID
export const getMenuItemById = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userStoreId = req.userStoreId;

        if (!userStoreId) {
            return handleError(
                res,
                "You must be associated with a store to view menu items.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // Managers and Admins can view any item within their store.
        // Users and Guests can also view items within their store.
        const whereClause = and(
            eq(menuItems.id, id),
            eq(menuItems.storeId, userStoreId), // CRITICAL: Always filter by user's storeId
        );

        const menuItem = await db.query.menuItems.findFirst({
            where: whereClause,
        });

        if (!menuItem) {
            return handleError(
                res,
                "Menu item not found",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        res.status(StatusCodeEnum.OK).json(menuItem);
    } catch (error) {
        console.error(error);
        return handleError(
            res,
            "Problem loading menu item, please try again",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

// Create a new menu item
export const createMenuItem = async (req: Request, res: Response) => {
    try {
        const {
            name,
            price,
            isAvailable,
            itemCode: providedItemCode,
        } = req.body;

        const userStoreId = req.userStoreId;

        if (!userStoreId) {
            return handleError(
                res,
                "Store ID not found for the authenticated user.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // Validate required fields early
        if (!name || price === undefined) {
            return handleError(
                res,
                "Name and price are required.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        const existingItemByName = await db
            .select()
            .from(menuItems)
            .where(
                and(
                    eq(menuItems.name, name),
                    eq(menuItems.storeId, userStoreId), // Filter by current user's storeId
                ),
            )
            .limit(1);

        if (existingItemByName.length > 0) {
            return handleError(
                res,
                "Name already exists. Please edit the menu item rather than creating a new one.",
                StatusCodeEnum.CONFLICT,
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
                        eq(menuItems.storeId, userStoreId), // Filter by current user's storeId
                    ),
                )
                .limit(1);

            if (existingItem.length > 0) {
                return handleError(
                    res,
                    `Item code '${providedItemCode}' is already in use. Please provide a different one or leave it blank to auto-generate.`,
                    StatusCodeEnum.CONFLICT,
                );
            }

            finalItemCode = providedItemCode;
        } else {
            // If no itemCode is provided, auto-generate a unique one
            // This `generateUniqueItemCode` function should ideally ensure uniqueness globally or per store.
            // It suppose to be unique globally and human readable. I will come back for it later.
            finalItemCode = await generateUniqueItemCode(); // Assuming this is robust
        }

        const [newItem] = await db
            .insert(menuItems)
            .values({
                name,
                itemCode: finalItemCode,
                price: String(price),
                isAvailable: isAvailable ?? true,
                storeId: userStoreId, // Always use the user's storeId
            })
            .returning();

        res.status(StatusCodeEnum.CREATED).json(newItem);
    } catch (error: any) {
        console.error(error);
        // *** Improved error handling for database unique constraint violations ***
        if (error.cause && error.cause.code === "23505") {
            // PostgreSQL unique violation error code
            if (error.cause.constraint === "menuItems_name_store_unique") {
                return handleError(
                    res,
                    "A menu item with this name already exists in your store.",
                    StatusCodeEnum.CONFLICT,
                );
            }
            if (error.cause.constraint === "menuItems_itemCode_store_unique") {
                return handleError(
                    res,
                    "A menu item with this item code already exists in your store.",
                    StatusCodeEnum.CONFLICT,
                );
            }
            // If itemCode was globally unique and caused an error
            if (error.cause.constraint === "menuItems_itemCode_unique") {
                return handleError(
                    res,
                    "A menu item with this item code already exists globally. Please provide a different one.",
                    StatusCodeEnum.CONFLICT,
                );
            }
        }

        handleError(
            res,
            "Problem creating menu items, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

// Update a menu item
export const updateMenuItem = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, isAvailable, itemCode } = req.body;
        const userStoreId = req.userStoreId!;

        // CRITICAL: Fetch the item, making sure it belongs to the current user's store.
        const findWhereClause = and(
            eq(menuItems.id, id),
            eq(menuItems.storeId, userStoreId),
        );

        // First, get the current state of the menu item
        const currentItem = await db.query.menuItems.findFirst({
            where: findWhereClause,
        });

        if (!currentItem) {
            return handleError(
                res,
                "Menu item not found",
                StatusCodeEnum.NOT_FOUND,
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
            // CRITICAL: Check for uniqueness of updated name within the store
            if (name !== currentItem.name) {
                const existingItemWithName = await db.query.menuItems.findFirst(
                    {
                        where: and(
                            eq(menuItems.name, name),
                            eq(menuItems.storeId, userStoreId),
                            ne(menuItems.id, id), // Exclude the current item
                        ),
                    },
                );
                if (existingItemWithName) {
                    return handleError(
                        res,
                        `An item with the name '${name}' already exists in your store.`,
                        StatusCodeEnum.CONFLICT,
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
                            eq(menuItems.storeId, userStoreId),
                            ne(menuItems.id, id), // Exclude the current item
                        ),
                    },
                );
                if (existingItemWithCode) {
                    return handleError(
                        res,
                        `Item code '${itemCode}' is already in use by another item, create another one or leave it blank to auto-generate.`,
                        StatusCodeEnum.CONFLICT,
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
            return handleError(
                res,
                "No valid fields provided for update.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        const updatedItem = await db
            .update(menuItems)
            .set(updateData)
            .where(findWhereClause)
            .returning();

        if (updatedItem.length === 0) {
            return handleError(
                res,
                "Menu item not found or no changes made.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        res.status(StatusCodeEnum.OK).json(updatedItem[0]);
    } catch (error) {
        // Handle potential unique constraint errors, e.g., if the new name is already taken
        console.error(error);
        handleError(
            res,
            "The provided name or item code is already in use.",
            StatusCodeEnum.CONFLICT,
        );
    }
};

// Delete a menu item
export const deleteMenuItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userStoreId = req.userStoreId;

        if (!userStoreId) {
            return handleError(
                res,
                "You must be associated with a store to delete menu items.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // CRITICAL: Ensure the item being deleted belongs to the user's store
        const whereClause = and(
            eq(menuItems.id, id),
            eq(menuItems.storeId, userStoreId),
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
                .status(StatusCodeEnum.NOT_FOUND)
                .json({ message: "Menu item not found" });
        }
        res.status(StatusCodeEnum.OK).json({
            message: "Menu item deleted successfully",
        });
    } catch (error) {
        console.error(error);
        return handleError(
            res,
            "Problem deleting menu items, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
