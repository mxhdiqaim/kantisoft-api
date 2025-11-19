import db from "../db";
import { and, eq } from "drizzle-orm";
import { inventory } from "../schema/inventory-schema";

// Helper function to check stock existence and authorisation
export const getInventoryByMenuItemId = async (
    menuItemId: string,
    storeId: string,
) => {
    return db.query.inventory.findFirst({
        where: and(
            eq(inventory.menuItemId, menuItemId),
            eq(inventory.storeId, storeId),
        ),
        with: { menuItem: { columns: { name: true, itemCode: true } } },
    });
};
