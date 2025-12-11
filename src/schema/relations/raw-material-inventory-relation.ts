import { relations } from "drizzle-orm";
import { rawMaterialInventory } from "../raw-materials-schema/raw-material-inventory-schema";
import { stores } from "../stores-schema";
import { rawMaterials } from "../raw-materials-schema";

export const rawMaterialInventoryRelations = relations(
    rawMaterialInventory,
    ({ one }) => ({
        // Each inventory record belongs to one store
        store: one(stores, {
            fields: [rawMaterialInventory.storeId],
            references: [stores.id],
        }),

        // Each inventory record tracks one specific raw material
        rawMaterial: one(rawMaterials, {
            fields: [rawMaterialInventory.rawMaterialId],
            references: [rawMaterials.id],
        }),
    }),
);
