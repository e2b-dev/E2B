-- Modify "tiers" table
ALTER TABLE "public"."tiers" DROP CONSTRAINT "tiers_ram_mb_check", DROP CONSTRAINT "tiers_vcpu_check", DROP COLUMN "vcpu", DROP COLUMN "ram_mb";
