CREATE TYPE "public"."inventoryStatus" AS ENUM('inStock', 'lowStock', 'outOfStock', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."transactionType" AS ENUM('sale', 'purchaseReceive', 'adjustmentIn', 'adjustmentOut', 'transferOut', 'transferIn');--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'INVENTORY_RECORD_CREATED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STOCK_ADJUSTED_SALE';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STOCK_ADJUSTED_PURCHASE_RECEIVE';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STOCK_ADJUSTED_ADJUSTMENT_IN';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STOCK_ADJUSTED_ADJUSTMENT_OUT';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STOCK_ADJUSTED_TRANSFER_IN';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STOCK_ADJUSTED_TRANSFER_OUT';--> statement-breakpoint
ALTER TYPE "public"."entityType" ADD VALUE 'inventory';--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menuItemId" uuid NOT NULL,
	"storeId" uuid NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"minStockLevel" integer DEFAULT 10 NOT NULL,
	"status" "inventoryStatus" DEFAULT 'inStock' NOT NULL,
	"lastCountDate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_menuItem_store_unique" UNIQUE("menuItemId","storeId")
);
--> statement-breakpoint
CREATE TABLE "inventoryTransactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menuItemId" uuid NOT NULL,
	"storeId" uuid NOT NULL,
	"transactionType" "transactionType" DEFAULT 'sale' NOT NULL,
	"quantityChange" double precision NOT NULL,
	"resultingQuantity" double precision,
	"sourceDocumentId" uuid,
	"performedBy" uuid,
	"notes" text,
	"transactionDate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_menuItemId_menuItems_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menuItems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventoryTransactions" ADD CONSTRAINT "inventoryTransactions_menuItemId_menuItems_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menuItems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventoryTransactions" ADD CONSTRAINT "inventoryTransactions_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventoryTransactions" ADD CONSTRAINT "inventoryTransactions_performedBy_users_id_fk" FOREIGN KEY ("performedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;