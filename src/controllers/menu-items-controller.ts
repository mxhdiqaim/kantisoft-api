import { desc, eq, isNull } from "drizzle-orm";
import { Request, Response } from "express";
import db from "../db";
import { menuItems } from "../schema/menu-items-schema";
import { generateUniqueItemCode } from "../utils/generate-unique-item-code";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";

// Get all menu items
export const getAllMenuItems = async (req: Request, res: Response) => {
    try {
        // --- Start of data reconciliation logic ---
        // Find a default store to assign to items without one.
        const defaultStore = await db.query.stores.findFirst();

        if (defaultStore) {
            // Find all menu items that don't have a storeId
            const itemsWithoutStore = await db
                .select({ id: menuItems.id })
                .from(menuItems)
                .where(isNull(menuItems.storeId));

            if (itemsWithoutStore.length > 0) {
                console.log(
                    `Found ${itemsWithoutStore.length} menu items without a store. Updating...`,
                );
                // Create an array of update promises
                const updatePromises = itemsWithoutStore.map((item) =>
                    db
                        .update(menuItems)
                        .set({ storeId: defaultStore.id })
                        .where(eq(menuItems.id, item.id)),
                );
                // Execute all updates in parallel
                await Promise.all(updatePromises);
                console.log(
                    "Finished updating menu items with a default storeId.",
                );
            }
        }
        // --- End of data reconciliation logic ---

        // Allow filtering by storeId via query parameter
        const storeId = req.query.storeId as string | undefined;
        const whereClause = storeId
            ? eq(menuItems.storeId, storeId)
            : undefined;

        const allMenuItems = await db.query.menuItems.findMany({
            where: whereClause,
            orderBy: [desc(menuItems.createdAt)],
        });

        res.status(StatusCodeEnum.OK).json(allMenuItems);
    } catch (error) {
        console.error(error);
        handleError(res, "Problem loading menu items, please try again", 500);
    }
};

// Get a single menu item by ID
export const getMenuItemById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const menuItem = await db
            .select()
            .from(menuItems)
            .where(eq(menuItems.id, id));
        if (menuItem.length === 0) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        res.status(200).json(menuItem[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Problem loading menu item, please try again.",
        });
    }
};

// Create a new menu item
export const createMenuItem = async (req: Request, res: Response) => {
    const {
        name,
        price,
        isAvailable,
        itemCode: providedItemCode,
        storeId,
    } = req.body;

    try {
        const existingItemByName = await db
            .select()
            .from(menuItems)
            .where(eq(menuItems.name, name))
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
                .where(eq(menuItems.itemCode, providedItemCode))
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
            finalItemCode = await generateUniqueItemCode();
        }

        if (!name || price === undefined || !storeId) {
            return res
                .status(400)
                .json({ message: "Name and price are required" });
        }
        const newItem = await db
            .insert(menuItems)
            .values({
                name,
                price: String(price),
                isAvailable,
                itemCode: finalItemCode,
                storeId,
            })
            .returning();
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Problem creating menu items, please try again.",
        });
    }
};

// Update a menu item
export const updateMenuItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, isAvailable, itemCode } = req.body;

        // First, get the current state of the menu item
        const currentItem = await db.query.menuItems.findFirst({
            where: eq(menuItems.id, id),
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
        } = {};

        if (name !== undefined) updateData.name = name;
        if (price !== undefined) updateData.price = String(price);
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        // If an item code is provided, use it.
        if (itemCode !== undefined) {
            updateData.itemCode = itemCode;
        } else if (!currentItem.itemCode) {
            // If no item code is provided AND the item doesn't have one, generate it.
            updateData.itemCode = await generateUniqueItemCode();
        }

        if (Object.keys(updateData).length === 0) {
            return handleError(
                res,
                "No fields to update provided.",
                StatusCodeEnum.BAD_REQUEST,
            );
            // return res
            //     .status(400)
            //     .json({ message: "No fields to update provided." });
        }

        const updatedItem = await db
            .update(menuItems)
            .set(updateData)
            .where(eq(menuItems.id, id))
            .returning();

        if (updatedItem.length === 0) {
            return handleError(
                res,
                "Menu item not found or no changes made.",
                StatusCodeEnum.NOT_FOUND,
            );
        }
        res.status(200).json(updatedItem[0]);
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
        const deletedItem = await db
            .delete(menuItems)
            .where(eq(menuItems.id, id))
            .returning();
        if (deletedItem.length === 0) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        res.status(200).json({ message: "Menu item deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Problem deleting menu items, please try again.",
        });
    }
};
