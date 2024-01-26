-- Add base tier
INSERT INTO public.tiers (id, name, vcpu, ram_mb, disk_mb, concurrent_instances) VALUES ('base_v1', 'Base tier', 2, 512, 512, 20);

-- Create user for triggers
CREATE USER trigger_user;
GRANT trigger_user TO postgres;

GRANT CREATE, USAGE ON SCHEMA public TO trigger_user;
GRANT USAGE ON SCHEMA extensions TO trigger_user;
GRANT USAGE ON SCHEMA auth TO trigger_user;

GRANT SELECT, INSERT, TRIGGER ON public.teams TO trigger_user;
GRANT INSERT ON public.users_teams TO trigger_user;
GRANT INSERT ON public.team_api_keys TO trigger_user;
GRANT INSERT ON public.access_tokens TO trigger_user;

--
CREATE OR REPLACE FUNCTION public.generate_default_team_trigger()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $create_default_team$
DECLARE
    team_id                 uuid;
BEGIN
    RAISE NOTICE 'Creating default team for user %', NEW.id;
    INSERT INTO public.teams(name, is_default, tier, email) VALUES (NEW.email, true, 'base_v1', NEW.email) RETURNING id INTO team_id;
    INSERT INTO public.users_teams(user_id, team_id) VALUES (NEW.id, team_id);
    RAISE NOTICE 'Created default team for user % and team %', NEW.id, team_id;
    RETURN NEW;
END
$create_default_team$ SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.generate_default_team_trigger() OWNER TO trigger_user;

CREATE OR REPLACE TRIGGER create_default_team
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION generate_default_team_trigger();


CREATE OR REPLACE FUNCTION public.generate_teams_api_keys_trigger() RETURNS TRIGGER
    LANGUAGE plpgsql
AS $generate_teams_api_keys$
DECLARE
    key_prefix TEXT := 'e2b_';
    generated_key TEXT;
BEGIN
    -- Generate a random 20 byte string and encode it as hex, so it's 40 characters
    generated_key := encode(extensions.gen_random_bytes(20), 'hex');
    INSERT INTO public.team_api_keys (team_id, api_key)
    VALUES (NEW.id, key_prefix || generated_key);
    RETURN NEW;
END
$generate_teams_api_keys$ SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.generate_teams_api_keys_trigger() OWNER TO trigger_user;

CREATE OR REPLACE TRIGGER team_api_keys_trigger
    AFTER INSERT ON public.teams
    FOR EACH ROW EXECUTE FUNCTION generate_teams_api_keys_trigger();



CREATE OR REPLACE FUNCTION public.generate_access_token_trigger() RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $generate_access_token$
DECLARE
    key_prefix TEXT := 'sk_e2b_';
    generated_key TEXT;
BEGIN
    -- Generate a random 20 byte string and encode it as hex, so it's 40 characters
    generated_key := encode(extensions.gen_random_bytes(20), 'hex');
    INSERT INTO public.access_tokens (user_id, access_token)
    VALUES (NEW.id, key_prefix || generated_key);
    RETURN NEW;
END;
$generate_access_token$ SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.generate_access_token_trigger() OWNER TO trigger_user;


CREATE OR REPLACE TRIGGER create_access_token
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION generate_access_token_trigger();


CREATE POLICY "Allow to create an access token to new user"
    ON public.access_tokens
    AS PERMISSIVE
    FOR INSERT
    TO trigger_user
    WITH CHECK (TRUE);

CREATE POLICY "Allow to create a team to new user"
    ON public.teams
    AS PERMISSIVE
    FOR INSERT
    TO trigger_user
    WITH CHECK (TRUE);

CREATE POLICY "Allow to create a user team connection to new user"
    ON public.users_teams
    AS PERMISSIVE
    FOR INSERT
    TO trigger_user
    WITH CHECK (TRUE);

CREATE POLICY "Allow to select a team for supabase auth admin"
    ON public.teams
    AS PERMISSIVE
    FOR SELECT
    TO trigger_user
    USING (TRUE);

CREATE POLICY "Allow to create a team api key to new user"
    ON public.team_api_keys
    AS PERMISSIVE
    FOR INSERT
    TO trigger_user
    WITH CHECK (TRUE);
