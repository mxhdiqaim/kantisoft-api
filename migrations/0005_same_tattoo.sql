CREATE TYPE "public"."rawInventoryStatus" AS ENUM('inStock', 'lowStock', 'outOfStock', 'onOrder');--> statement-breakpoint
CREATE TYPE "public"."unitFamily" AS ENUM('WEIGHT', 'VOLUME', 'COUNT', 'AREA');--> statement-breakpoint
CREATE TABLE "billOfMaterials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menuItemId" uuid NOT NULL,
	"rawMaterialId" uuid NOT NULL,
	"consumptionQuantityBase" double precision NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bom_menuItem_material_unique" UNIQUE("menuItemId","rawMaterialId")
);
--> statement-breakpoint
CREATE TABLE "rawMaterials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"unitOfMeasurementId" uuid NOT NULL,
	"description" text,
	"latestUnitPrice" double precision DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rawMaterialInventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rawMaterialId" uuid NOT NULL,
	"storeId" uuid NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"minStockLevel" double precision DEFAULT 0 NOT NULL,
	"status" "rawInventoryStatus" DEFAULT 'inStock' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "raw_inventory_material_store_unique" UNIQUE("rawMaterialId","storeId")
);
--> statement-breakpoint
CREATE TABLE "unitOfMeasurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"unitFamily" "unitFamily" NOT NULL,
	"conversionFactorToBase" double precision DEFAULT 1 NOT NULL,
	"isBaseUnit" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventoryTransactions" ADD COLUMN "rawMaterialId" uuid;--> statement-breakpoint
ALTER TABLE "billOfMaterials" ADD CONSTRAINT "billOfMaterials_menuItemId_menuItems_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menuItems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billOfMaterials" ADD CONSTRAINT "billOfMaterials_rawMaterialId_rawMaterials_id_fk" FOREIGN KEY ("rawMaterialId") REFERENCES "public"."rawMaterials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawMaterials" ADD CONSTRAINT "rawMaterials_unitOfMeasurementId_unitOfMeasurement_id_fk" FOREIGN KEY ("unitOfMeasurementId") REFERENCES "public"."unitOfMeasurement"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawMaterialInventory" ADD CONSTRAINT "rawMaterialInventory_rawMaterialId_rawMaterials_id_fk" FOREIGN KEY ("rawMaterialId") REFERENCES "public"."rawMaterials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawMaterialInventory" ADD CONSTRAINT "rawMaterialInventory_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raw_material_name_unique" ON "rawMaterials" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_symbol_unique" ON "unitOfMeasurement" USING btree ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_name_unique" ON "unitOfMeasurement" USING btree ("name");--> statement-breakpoint
ALTER TABLE "inventoryTransactions" ADD CONSTRAINT "inventoryTransactions_rawMaterialId_rawMaterials_id_fk" FOREIGN KEY ("rawMaterialId") REFERENCES "public"."rawMaterials"("id") ON DELETE no action ON UPDATE no action;