-- Co Pilot Security Marketplace v1.5.2
-- Platform Owner & Mission Control Access
-- One-time additive migration. Run once after the v1.5.1 migration set.
--
-- Security model:
--   1. The owner is resolved inside Postgres from auth.users.
--   2. The authoritative role is stored in public.profiles.
--   3. The frontend only consumes the profile role; it never grants access by email.
--   4. Existing platform_admin RLS policies enforce platform-wide read access.

DO $$
DECLARE
  owner_user_id uuid;
BEGIN
  SELECT id
    INTO owner_user_id
    FROM auth.users
   WHERE lower(email) = lower('afinch2678@gmail.com')
   ORDER BY created_at ASC
   LIMIT 1;

  IF owner_user_id IS NULL THEN
    RAISE EXCEPTION
      'Co Pilot owner account afinch2678@gmail.com was not found in auth.users. Create/authenticate that account first, then rerun this migration.';
  END IF;

  INSERT INTO public.profiles (id, role, account_status, full_name)
  SELECT
    owner_user_id,
    'platform_admin'::public.app_role,
    'approved'::public.account_status,
    NULLIF(raw_user_meta_data->>'full_name', '')
  FROM auth.users
  WHERE id = owner_user_id
  ON CONFLICT (id) DO UPDATE
    SET role = 'platform_admin'::public.app_role,
        account_status = 'approved'::public.account_status,
        updated_at = now();
END
$$;

-- Keep role resolution server-authoritative and unavailable to anonymous users.
REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

-- Verification (optional):
-- select u.email, p.role, p.account_status
-- from auth.users u
-- join public.profiles p on p.id = u.id
-- where lower(u.email) = lower('afinch2678@gmail.com');
