ALTER TYPE "public"."status" ADD VALUE 'banned';--> statement-breakpoint
ALTER TABLE "menuItems" ADD COLUMN "currentMenu" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menuItems" ADD COLUMN "minMenuLevel" integer DEFAULT 10;