CREATE TYPE "public"."rawMaterialStatus" AS ENUM('active', 'deleted', 'archived');--> statement-breakpoint
ALTER TABLE "rawMaterials" ADD COLUMN "status" "rawMaterialStatus" DEFAULT 'active' NOT NULL;