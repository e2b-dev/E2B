-- Modify "env_builds" table
ALTER TABLE "public"."env_builds" ADD COLUMN "envd_version" text NULL;

-- Populate "envd_version" column
UPDATE "public"."env_builds" SET "envd_version" = 'v0.0.1';
