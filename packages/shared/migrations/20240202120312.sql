-- Modify "envs" table
ALTER TABLE "public"."envs" ADD COLUMN "kernel_version" character varying NOT NULL DEFAULT 'vmlinux-5.10.186';
