-- Preserve this existing view while applying the underlying tables' RLS.
-- Anonymous callers must not enumerate developer Guard identities.
BEGIN;
ALTER VIEW public.developer_guard_identity SET (security_invoker = true);
REVOKE ALL ON public.developer_guard_identity FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.developer_guard_identity FROM authenticated;
COMMIT;
