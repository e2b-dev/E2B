-- Modify "envs" table
ALTER TABLE "public"."envs" ADD COLUMN "vcpu" bigint NOT NULL, ADD COLUMN "ram_mb" bigint NOT NULL, ADD COLUMN "free_disk_size_mb" bigint NOT NULL, ADD COLUMN "total_disk_size_mb" bigint NOT NULL;
