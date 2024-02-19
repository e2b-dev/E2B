-- Modify "envs" table
ALTER TABLE "public"."envs" ADD COLUMN "firecracker_version" character varying NOT NULL DEFAULT 'firecracker-v1.5.0';
