-- Modify "tiers" table
ALTER TABLE "public"."tiers" ADD COLUMN "max_length_hours" bigint NULL;
UPDATE "public"."tiers" SET "max_length_hours" = 1;
ALTER TABLE "public"."tiers" ALTER COLUMN "max_length_hours" SET NOT NULL;
