-- Modify "envs" table
ALTER TABLE "public"."envs" ADD COLUMN "kernel_version" character varying NULL;
UPDATE  "public"."envs" SET "kernel_version" = 'vmlinux-5.10.186-old';
ALTER TABLE "public"."envs" ALTER COLUMN "kernel_version" SET NOT NULL;
ALTER TABLE "public"."envs" ALTER COLUMN "kernel_version" SET DEFAULT 'vmlinux-5.10.186';
