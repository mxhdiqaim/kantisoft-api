ALTER TABLE "unitOfMeasurement" ALTER COLUMN "unitFamily" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."unitFamily";--> statement-breakpoint
CREATE TYPE "public"."unitFamily" AS ENUM('weight', 'volume', 'count', 'area');--> statement-breakpoint
ALTER TABLE "unitOfMeasurement" ALTER COLUMN "unitFamily" SET DATA TYPE "public"."unitFamily" USING "unitFamily"::"public"."unitFamily";