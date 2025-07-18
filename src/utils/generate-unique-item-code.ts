// src/utils/shortCodeGenerator.ts
import db from "../db";
import { menuItems } from "../schema/menu-items-schema";
import { sql, desc, eq } from "drizzle-orm"; // Import asc for ordering

/**
 * Generates the next available unique numeric item code for a menu item.
 * It finds the highest existing numeric item code and increments it.
 *
 * @returns {Promise<string>} The next unique item code as a string (e.g., '101').
 */
export const generateUniqueItemCode = async (): Promise<string> => {
    try {
        // Select the maximum itemCode, cast it to a number, and handle potential null (no items yet)
        // We order by itemCode descending and take the first one to reliably get the max.
        const latestItem = await db
            .select({
                itemCode:
                    sql<number>`CAST(${menuItems.itemCode} AS INTEGER)`.as(
                        "itemCode",
                    ),
            })
            .from(menuItems)
            .orderBy(desc(sql`CAST(${menuItems.itemCode} AS INTEGER)`)) // Use desc to get the highest
            .limit(1);

        const currentMaxCode = latestItem[0]?.itemCode || 0; // If no items, start from 0

        // Ensure a minimum starting code if you don't want to start from 1, 2, 3...
        // For example, if you want to start from 101, 102, etc.
        const MIN_START_CODE = 100;

        // Determine the next item code
        let nextCode = currentMaxCode + 1;

        if (nextCode < MIN_START_CODE) {
            nextCode = MIN_START_CODE;
        }

        // This loop is a safeguard. In case the calculated `nextCode` is already taken
        // (e.g., manual entry), it will find the next available one.
        // For a simple sequential generator, this check might be overkill, but it makes the function more robust.
        let isCodeUnique = false;
        while (!isCodeUnique) {
            const existingItem = await db
                .select({ id: menuItems.id })
                .from(menuItems)
                .where(eq(menuItems.itemCode, String(nextCode)))
                .limit(1);

            if (existingItem.length === 0) {
                isCodeUnique = true;
            } else {
                nextCode++; // If code is taken, increment and check again
            }
        }

        return String(nextCode);
    } catch (error) {
        console.error("Error generating unique short code:", error);
        // In a real application, you might throw a custom error or handle it more gracefully
        throw new Error("Failed to generate a unique short code.");
    }
};
