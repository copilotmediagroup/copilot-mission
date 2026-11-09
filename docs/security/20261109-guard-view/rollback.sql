-- Emergency rollback only. Restores the preflight access, including the old anonymous exposure.
-- Project: eznhyemkuxectndxtymc. Do not run as part of the forward migration.
BEGIN;
CREATE OR REPLACE VIEW public.developer_guard_identity AS
 SELECT g.id,
    g.user_id,
    g.agency_id,
    p.full_name AS name,
    g.availability,
    g.avatar_url
   FROM guards g
     LEFT JOIN profiles p ON p.id = g.user_id;
ALTER VIEW public.developer_guard_identity RESET (security_invoker);
REVOKE ALL ON public.developer_guard_identity FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON public.developer_guard_identity TO anon, authenticated, service_role;
COMMIT;
