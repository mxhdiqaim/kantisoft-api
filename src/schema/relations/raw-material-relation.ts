import { relations } from "drizzle-orm";
import { rawMaterials } from "../raw-materials-schema";
import { unitOfMeasurement } from "../unit-of-measurement-schema";
import { billOfMaterials } from "../bill-of-materials-schema";
import { rawMaterialInventory } from "../raw-materials-schema/raw-material-inventory-schema";

export const rawMaterialsRelations = relations(
    rawMaterials,
    ({ one, many }) => ({
        // Each raw material has one primary unit definition
        unitOfMeasurement: one(unitOfMeasurement, {
            fields: [rawMaterials.unitOfMeasurementId],
            references: [unitOfMeasurement.id],
        }),

        // A raw material can be a component in many different recipes (BOMs)
        billOfMaterials: many(billOfMaterials),

        // A raw material has many inventory records (one per store)
        rawMaterialInventory: many(rawMaterialInventory),
    }),
);
