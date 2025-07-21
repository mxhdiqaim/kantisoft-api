import {
    boolean,
    numeric,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores-schema";

export const menuItems = pgTable("menuItems", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    itemCode: text("itemCode").unique(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    storeId: uuid("storeId").references(() => stores.id),
    // storeId: uuid("storeId").references(() => stores.id).notNull()
    isAvailable: boolean("isAvailable").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});

export type MenuSchemaT = typeof menuItems.$inferSelect;
