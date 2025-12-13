CREATE TYPE "public"."rawMaterialTransactionSource" AS ENUM('purchaseReceipt', 'productionUsage', 'inventoryAdjustment', 'wastage', 'transferIn', 'transferOut');--> statement-breakpoint
CREATE TYPE "public"."rawMaterialTransactionType" AS ENUM('comingIn', 'goingOut');--> statement-breakpoint
CREATE TABLE "rawMaterialStockTransactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rawMaterialId" uuid NOT NULL,
	"storeId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"type" "rawMaterialTransactionType" NOT NULL,
	"source" "rawMaterialTransactionSource" NOT NULL,
	"quantityBase" double precision NOT NULL,
	"documentRefId" uuid,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rawMaterialStockTransactions" ADD CONSTRAINT "rawMaterialStockTransactions_rawMaterialId_rawMaterials_id_fk" FOREIGN KEY ("rawMaterialId") REFERENCES "public"."rawMaterials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawMaterialStockTransactions" ADD CONSTRAINT "rawMaterialStockTransactions_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawMaterialStockTransactions" ADD CONSTRAINT "rawMaterialStockTransactions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;