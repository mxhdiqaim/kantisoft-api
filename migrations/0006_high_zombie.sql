ALTER TABLE "menuItems" ALTER COLUMN "price" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "menuItems" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "menuItems" ADD COLUMN "storeId" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "storeId" uuid;--> statement-breakpoint
ALTER TABLE "menuItems" ADD CONSTRAINT "menuItems_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;