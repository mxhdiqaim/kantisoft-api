ALTER TABLE "menuItems" ADD COLUMN "itemCode" text;--> statement-breakpoint
ALTER TABLE "menuItems" ADD CONSTRAINT "menuItems_itemCode_unique" UNIQUE("itemCode");