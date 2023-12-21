-- Add base tier
INSERT INTO public.tiers (id, vcpu, ram_mb, disk_mb, concurrent_instances) VALUES ('base', 1, 256, 500, 5);

--
CREATE OR REPLACE FUNCTION public.generate_default_team() RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $create_default_team$
DECLARE
    team_id                 uuid;
BEGIN
    INSERT INTO public.teams(name, is_default, tier) VALUES (NEW.email, true, 'base') RETURNING id INTO team_id;
    INSERT INTO public.users_teams(user_id, team_id) VALUES (NEW.id, team_id);
    RAISE NOTICE 'Created default team for user % and team %', NEW.id, team_id;
    RETURN NEW;
END
$create_default_team$ SECURITY DEFINER SET search_path = public;

CREATE TRIGGER create_default_team
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION generate_default_team();


CREATE OR REPLACE FUNCTION public.generate_teams_api_keys() RETURNS TRIGGER
    LANGUAGE plpgsql
AS $generate_teams_api_keys$
DECLARE
    key_prefix VARCHAR := 'e2b_';
    generated_key VARCHAR;
BEGIN
    -- Generate a random 20 byte string and encode it as hex, so it's 40 characters
    generated_key := encode(extensions.gen_random_bytes(20), 'hex');
    RAISE NOTICE 'Generated API key % for team %', generated_key, NEW.id;
    INSERT INTO public.team_api_keys (team_id, api_key)
    VALUES (NEW.id, key_prefix || generated_key);
    RETURN NEW;
END
$generate_teams_api_keys$ SECURITY DEFINER SET search_path = public;

CREATE TRIGGER team_api_keys_trigger
    AFTER INSERT ON public.teams
    FOR EACH ROW EXECUTE FUNCTION generate_teams_api_keys();



CREATE OR REPLACE FUNCTION public.generate_access_token() RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $generate_access_token$
DECLARE
    key_prefix VARCHAR := 'sk_e2b_';
    generated_key VARCHAR;
BEGIN
    -- Generate a random 20 byte string and encode it as hex, so it's 40 characters
    generated_key := encode(extensions.gen_random_bytes(20), 'hex');
    INSERT INTO public.access_tokens (user_id, access_token)
    VALUES (NEW.id, key_prefix || generated_key);
    RETURN NEW;
END;
$generate_access_token$ SECURITY DEFINER SET search_path = public;


CREATE TRIGGER create_access_token
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION generate_access_token();
