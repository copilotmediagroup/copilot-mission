-- EMERGENCY ROLLBACK ONLY: restores the captured original access, including anonymous SELECT.
-- Run only if this replacement was applied and must be reverted; project eznhyemkuxectndxtymc.
BEGIN;
SET LOCAL lock_timeout='5s';
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
REVOKE ALL ON public.developer_guard_identity FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON public.developer_guard_identity TO anon,authenticated,service_role;
DROP FUNCTION copisec_identity.visible_guard_identities();
DROP SCHEMA copisec_identity;
COMMIT;
