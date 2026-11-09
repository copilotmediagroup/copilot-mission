-- REPLACEMENT PROPOSAL ONLY. The earlier invoker-only migration failed production
-- preflight because Agency Guard names disappeared. Separate approval is required.
-- This exposes only the existing six identity columns and does not broaden profiles RLS.
BEGIN;
CREATE SCHEMA IF NOT EXISTS copisec_identity;
REVOKE ALL ON SCHEMA copisec_identity FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA copisec_identity TO authenticated,service_role;
CREATE FUNCTION copisec_identity.visible_guard_identities()
RETURNS TABLE(id uuid,user_id uuid,agency_id uuid,name text,availability text,avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public SET row_security=off AS $$
 SELECT g.id,g.user_id,g.agency_id,p.full_name,g.availability,g.avatar_url
 FROM public.guards g LEFT JOIN public.profiles p ON p.id=g.user_id
 WHERE current_setting('role',true)='service_role'
 OR (EXISTS(SELECT 1 FROM public.profiles actor WHERE actor.id=auth.uid() AND actor.account_status::text='approved')
  AND (g.user_id=auth.uid() OR public.is_platform_admin() OR public.has_agency_access(g.agency_id,false)));
$$;
REVOKE ALL ON FUNCTION copisec_identity.visible_guard_identities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION copisec_identity.visible_guard_identities() TO authenticated,service_role;
CREATE OR REPLACE VIEW public.developer_guard_identity WITH(security_invoker=true)
AS SELECT * FROM copisec_identity.visible_guard_identities();
REVOKE ALL ON public.developer_guard_identity FROM PUBLIC,anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.developer_guard_identity FROM authenticated;
GRANT SELECT ON public.developer_guard_identity TO authenticated,service_role;
COMMIT;
