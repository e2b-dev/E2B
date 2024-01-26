-- Modify "teams" table
ALTER TABLE "public"."teams" ADD COLUMN "is_banned" boolean NOT NULL DEFAULT false, ADD COLUMN "blocked_reason" TEXT NULL;

