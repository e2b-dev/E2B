CREATE SCHEMA auth;
-- Create "users" table
CREATE TABLE "auth"."users"
(
    "id"                   uuid              NOT NULL DEFAULT gen_random_uuid(),
    "email"                text              NOT NULL,
    PRIMARY KEY ("id")
);
