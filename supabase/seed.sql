--
-- Add default user and project
--

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at)
VALUES 
  ('00000000-0000-0000-0000-000000000000', '5899f99d-a449-4bfa-8769-19c097aaf1f5', 'authenticated', 'authenticated', 'admin@admin.com', '$2a$12$1f9CpolPKQUmH7.wyiq3deC9NdXd6AqpiMSOdmVYT4XbW4VxrfMK6', '2022-10-04 03:41:27.39308+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2022-10-04 03:41:27.391146+00', '2022-10-04 03:41:27.39308+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES 
  ('5899f99d-a449-4bfa-8769-19c097aaf1f5', '5899f99d-a449-4bfa-8769-19c097aaf1f5'::uuid, '{"sub": "5899f99d-a449-4bfa-8769-19c097aaf1f5"}', 'email', 'email_provider_id', '2022-10-04 04:45:00.000+00', '2022-10-04 03:41:27.391146+00', '2022-10-04 03:41:27.39308+00');

INSERT INTO "public"."teams" (id, created_at, name, is_default)
    VALUES ('21d2e330-95fa-4b78-b677-47d0713de3da', NOW(), 'admin@admin.com', true);

INSERT INTO "public"."users_teams" (user_id, created_at, team_id)
VALUES ('5899f99d-a449-4bfa-8769-19c097aaf1f5', NOW(), '21d2e330-95fa-4b78-b677-47d0713de3da');

-- INSERT INTO "public"."projects" (id, created_at, data, team_id, name)
-- VALUES ('default_project', NOW(), '{}', '21d2e330-95fa-4b78-b677-47d0713de3da', 'Default Project');
