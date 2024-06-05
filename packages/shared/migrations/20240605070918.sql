DROP TRIGGER create_default_team ON auth.users;
DROP FUNCTION generate_default_team_trigger();
DROP TRIGGER team_api_keys_trigger ON public.teams;
DROP FUNCTION generate_teams_api_keys_trigger();
DROP TRIGGER create_access_token ON auth.users;
DROP FUNCTION generate_access_token_trigger();

CREATE OR REPLACE FUNCTION public.extra_for_post_user_signup(user_id uuid, team_id uuid)
    RETURNS void
    LANGUAGE plpgsql
AS $extra_for_post_user_signup$
DECLARE
BEGIN
END
$extra_for_post_user_signup$ SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_team_api_key()
    RETURNS string
    LANGUAGE plpgsql
AS $generate_team_api_key$
DECLARE
    team_api_key_prefix TEXT := 'e2b_';
    generated_key TEXT;
BEGIN
    -- Generate a random 20 byte string and encode it as hex, so it's 40 characters
    generated_key := encode(extensions.gen_random_bytes(20), 'hex');
    RETURN team_api_key_prefix || generated_key;
END
$generate_team_api_key$ SECURITY DEFINER SET search_path = public;

ALTER TABLE public.team_api_keys ALTER COLUMN api_key SET DEFAULT public.generate_team_api_key();

CREATE OR REPLACE FUNCTION public.generate_access_token()
    RETURNS string
    LANGUAGE plpgsql
AS $extra_for_post_user_signup$
DECLARE
    access_token_prefix TEXT := 'sk_e2b_';
    generated_token TEXT;
BEGIN
    -- Generate a random 20 byte string and encode it as hex, so it's 40 characters
    generated_token := encode(extensions.gen_random_bytes(20), 'hex');
    RETURN access_token_prefix || generated_token;
END
$extra_for_post_user_signup$ SECURITY DEFINER SET search_path = public;

ALTER TABLE public.access_tokens ALTER COLUMN access_token SET DEFAULT public.generate_access_token();

ALTER FUNCTION public.extra_for_post_user_signup() OWNER TO trigger_user;

CREATE OR REPLACE FUNCTION public.post_user_signup()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $post_user_signup$
DECLARE
    team_id                 uuid;
BEGIN
    RAISE NOTICE 'Creating default team for user %', NEW.id;
    INSERT INTO public.teams(name, is_default, tier, email) VALUES (NEW.email, true, 'base_v1', NEW.email) RETURNING id INTO team_id;
    INSERT INTO public.users_teams(user_id, team_id) VALUES (NEW.id, team_id);
    RAISE NOTICE 'Created default team for user % and team %', NEW.id, team_id;

    -- Generate a random 20 byte string and encode it as hex, so it's 40 characters
    INSERT INTO public.team_api_keys (team_id)
    VALUES (team_id);

    INSERT INTO public.access_tokens (user_id)
    VALUES (NEW.id);

    PERFORM public.extra_for_post_user_signup(NEW.id, team_id);

    RETURN NEW;
END
$post_user_signup$ SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.post_user_signup() OWNER TO trigger_user;


CREATE OR REPLACE TRIGGER post_user_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION post_user_signup();


CREATE OR REPLACE FUNCTION is_member_of_team(_user_id uuid, _team_id uuid) RETURNS bool AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.users_teams ut
    WHERE ut.user_id = _user_id
      AND ut.team_id = _team_id
);
$$ LANGUAGE sql SECURITY DEFINER;

-- Create RLS policies for user management
DO $$
    BEGIN
        BEGIN
            CREATE POLICY "Allow users to delete a team api key"
                ON "public"."team_api_keys"
                AS PERMISSIVE
                FOR DELETE
                TO authenticated
                USING ((SELECT auth.uid()) IN ( SELECT users_teams.user_id
                    FROM users_teams
                    WHERE (users_teams.team_id = team_api_keys.team_id)));

            CREATE POLICY "Allow users to create a new team user entry"
                ON "public"."users_teams"
                AS PERMISSIVE
                FOR INSERT
                TO authenticated
                WITH CHECK (team_id IN ( SELECT users_teams.team_id
                FROM users_teams
                WHERE (users_teams.user_id = (SELECT auth.uid()))));

            CREATE POLICY  "Allow users to delete a team user entry"
                ON public.users_teams
                AS PERMISSIVE
                FOR DELETE
                TO authenticated
                USING (team_id IN ( SELECT users_teams.team_id
                FROM users_teams
                WHERE (users_teams.user_id = auth.uid())));

            CREATE POLICY "Allow update for users that are in the team"
                ON "public"."teams"
                AS PERMISSIVE
                FOR UPDATE
                TO authenticated
                USING ((auth.uid() IN ( SELECT users_teams.user_id
                FROM users_teams
                WHERE (users_teams.team_id = teams.id))));

            ALTER POLICY "Enable select for users in relevant team"
                on "public"."users_teams"
                to authenticated
                using (is_member_of_team(auth.uid(), team_id)
            );

        END;
    END $$;
;