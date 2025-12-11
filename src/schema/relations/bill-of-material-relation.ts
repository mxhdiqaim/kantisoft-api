import { relations } from "drizzle-orm";
import { billOfMaterials } from "../bill-of-materials-schema";
import { menuItems } from "../menu-items-schema";
import { rawMaterials } from "../raw-materials-schema";

export const billOfMaterialsRelations = relations(
    billOfMaterials,
    ({ one }) => ({
        // A BOM entry defines the recipe for one finished menu item
        menuItem: one(menuItems, {
            fields: [billOfMaterials.menuItemId],
            references: [menuItems.id],
        }),

        // A BOM entry specifies one raw material part
        rawMaterial: one(rawMaterials, {
            fields: [billOfMaterials.rawMaterialId],
            references: [rawMaterials.id],
        }),
    }),
);
