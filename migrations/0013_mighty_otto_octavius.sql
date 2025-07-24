ALTER TABLE "menuItems" DROP CONSTRAINT "menuItems_name_unique";--> statement-breakpoint
ALTER TABLE "menuItems" DROP CONSTRAINT "menuItems_itemCode_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_unique";--> statement-breakpoint
ALTER TABLE "menuItems" ADD CONSTRAINT "menuItems_name_store_unique" UNIQUE("storeId","name");--> statement-breakpoint
ALTER TABLE "menuItems" ADD CONSTRAINT "menuItems_itemCode_store_unique" UNIQUE("storeId","itemCode");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_storeId_phone_unique" UNIQUE("storeId","phone");