import { relations } from "drizzle-orm";
import { unitOfMeasurement } from "../unit-of-measurement-schema";
import { rawMaterials } from "../raw-materials-schema";

export const unitsRelations = relations(unitOfMeasurement, ({ many }) => ({
    // A unit (e.g. 'kg') can be referenced by many raw materials (e.g. 'Flour', 'Sugar')
    rawMaterials: many(rawMaterials),
}));
