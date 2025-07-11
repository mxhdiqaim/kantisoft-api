import { Request, Response } from 'express';
import db from '../db';
import { menuItems } from '../schema/menu-items-schema';
import { eq } from 'drizzle-orm';

// Get all menu items
export const getAllMenuItems = async (req: Request, res: Response) => {
    try {
        const allMenuItems = await db.select().from(menuItems);
        res.status(200).json(allMenuItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching menu items' });
    }
};

// Get a single menu item by ID
export const getMenuItemById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const menuItem = await db.select().from(menuItems).where(eq(menuItems.id, id));
        if (menuItem.length === 0) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        res.status(200).json(menuItem[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching menu item' });
    }
};

// Create a new menu item
export const createMenuItem = async (req: Request, res: Response) => {
    try {
        const { name, price, isAvailable } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Name and price are required' });
        }
        const newItem = await db.insert(menuItems).values({ name, price, isAvailable }).returning();
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating menu item' });
    }
};

// Update a menu item
export const updateMenuItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, isAvailable } = req.body;
        const updatedItem = await db.update(menuItems)
            .set({ name, price, isAvailable })
            .where(eq(menuItems.id, id))
            .returning();
        if (updatedItem.length === 0) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        res.status(200).json(updatedItem[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating menu item' });
    }
};

// Delete a menu item
export const deleteMenuItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const deletedItem = await db.delete(menuItems).where(eq(menuItems.id, id)).returning();
        if (deletedItem.length === 0) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        res.status(200).json({ message: 'Menu item deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting menu item' });
    }
};