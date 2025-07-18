import { eq } from "drizzle-orm";
import { Request, Response } from "express";
import db from "../db";
import { menuItems } from "../schema/menu-items-schema";
import { generateUniqueItemCode } from "../utils/generate-unique-item-code";
import { handleError } from "../service/error-handling";

// Get all menu items
export const getAllMenuItems = async (req: Request, res: Response) => {
    try {
        const allMenuItems = await db.select().from(menuItems);
        res.status(200).json(allMenuItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Problem loading menu items, please try again.",
        });
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
    const { name, price, isAvailable, itemCode: providedItemCode } = req.body;

    try {
        const existingItemByName = await db
            .select()
            .from(menuItems)
            .where(eq(menuItems.name, name))
            .limit(1);

        if (existingItemByName.length > 0) {
            return res.status(409).json({
                message:
                    "Name already exists. Please edit the menu item rather than creating a new one.",
            });
        }

        let finalItemCode: string;

        if (providedItemCode) {
            const existingItem = await db
                .select()
                .from(menuItems)
                .where(eq(menuItems.itemCode, providedItemCode))
                .limit(1);

            if (existingItem.length > 0) {
                return res.status(409).json({
                    message: `Item code '${providedItemCode}' is already in use. Please provide a different one or leave it blank to auto-generate.`,
                });
            }

            finalItemCode = providedItemCode;
        } else {
            // If no itemCode is provided, auto-generate a unique one
            finalItemCode = await generateUniqueItemCode();
        }

        if (!name || price === undefined) {
            return res
                .status(400)
                .json({ message: "Name and price are required" });
        }
        const newItem = await db
            .insert(menuItems)
            .values({ name, price, isAvailable, itemCode: finalItemCode })
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
            return res.status(404).json({ message: "Menu item not found" });
        }

        const updateData: {
            name?: string;
            price?: number;
            isAvailable?: boolean;
            itemCode?: string;
        } = {};

        if (name !== undefined) updateData.name = name;
        if (price !== undefined) updateData.price = price;
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        // If an item code is provided, use it.
        if (itemCode !== undefined) {
            updateData.itemCode = itemCode;
        } else if (!currentItem.itemCode) {
            // If no item code is provided AND the item doesn't have one, generate it.
            updateData.itemCode = await generateUniqueItemCode();
        }

        if (Object.keys(updateData).length === 0) {
            return res
                .status(400)
                .json({ message: "No fields to update provided." });
        }

        const updatedItem = await db
            .update(menuItems)
            .set(updateData)
            .where(eq(menuItems.id, id))
            .returning();

        if (updatedItem.length === 0) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        res.status(200).json(updatedItem[0]);
    } catch (error) {
        // Handle potential unique constraint errors, e.g., if the new name is already taken
        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
        ) {
            return res.status(409).json({
                message: "The provided name or item code is already in use.",
            });
        }
        handleError(res, error);
    }
};

// export const updateMenuItem = async (req: Request, res: Response) => {
//     try {
//         const { id } = req.params;
//         const { name, price, isAvailable } = req.body;
//         const updatedItem = await db
//             .update(menuItems)
//             .set({ name, price, isAvailable })
//             .where(eq(menuItems.id, id))
//             .returning();
//         if (updatedItem.length === 0) {
//             return res.status(404).json({ message: "Menu item not found" });
//         }
//         res.status(200).json(updatedItem[0]);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Error updating menu item" });
//     }
// };

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
