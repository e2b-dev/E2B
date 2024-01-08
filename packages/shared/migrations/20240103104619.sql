-- Modify "teams" table
ALTER TABLE "public"."teams" ADD COLUMN "email" character varying(255) NULL;


CREATE OR REPLACE FUNCTION public.generate_default_team() RETURNS TRIGGER
    LANGUAGE plpgsql
AS $create_default_team$
DECLARE
    team_id                 uuid;
BEGIN
    INSERT INTO public.teams(name, is_default, tier, email) VALUES (NEW.email, true, 'base', NEW.email) RETURNING id INTO team_id;
    INSERT INTO public.users_teams(user_id, team_id) VALUES (NEW.id, team_id);
    RAISE NOTICE 'Created default team for user % and team %', NEW.id, team_id;
    RETURN NEW;
END
$create_default_team$ SECURITY DEFINER SET search_path = public;

UPDATE "public"."teams" SET "email" = "name";

ALTER TABLE "public"."teams" ALTER COLUMN "email" SET NOT NULL;