-- OFFLINE SYNTHETIC CI PostgreSQL 17 only: no live credentials or customer data.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'cm_helper_ci' THEN
  RAISE EXCEPTION 'Refuse unless disposable cm_helper_ci PostgreSQL database';
 END IF;
END $guard$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TYPE public.user_role AS ENUM ('BUYER','DEALER','ADMIN');
CREATE TABLE public.users (id text PRIMARY KEY, role public.user_role NOT NULL, "deletedAt" timestamp);
CREATE TABLE public.dealer_profiles (id text PRIMARY KEY,"userId" text,"isVerified" boolean NOT NULL);
CREATE TABLE public.dealer_staff ("dealerProfileId" text,"userId" text,"isActive" boolean NOT NULL);
CREATE TABLE public.listings (id text PRIMARY KEY,"sellerId" text NOT NULL);
INSERT INTO public.users VALUES
('11111111-1111-4111-8111-111111111111','BUYER',NULL),
('22222222-2222-4222-8222-222222222222','DEALER',NULL),
('33333333-3333-4333-8333-333333333333','ADMIN',NULL);
INSERT INTO public.dealer_profiles VALUES ('dealer-01','22222222-2222-4222-8222-222222222222',true);
INSERT INTO public.dealer_staff VALUES ('dealer-01','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.listings VALUES ('seller-listing','11111111-1111-4111-8111-111111111111');

-- Synthetic, TRUSTED gateway mapping only. Direct GUC mutation by synthetic CI
-- does NOT prove the security of real Supabase JWT validation/PostgREST itself.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Reproduce the inherited DDL grant seen in live before hardening.
GRANT USAGE,CREATE ON SCHEMA public TO PUBLIC;
DO $$
BEGIN
 IF NOT has_schema_privilege('anon','public','CREATE') OR
    NOT has_schema_privilege('authenticated','public','CREATE') THEN
  RAISE EXCEPTION 'Synthetic baseline does not reproduce live unsafe DDL grant';
 END IF;
END $$;

-- Test function signatures and business logic grounded in observed live public
-- definitions, but restrict ALL five hardened SECURITY DEFINER search_path to
-- empty; note the role/JWT/storage integration is synthetic only.
CREATE FUNCTION public.current_uid() RETURNS text LANGUAGE sql
 STABLE SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT auth.uid()::text $$;
CREATE FUNCTION public.has_user_role(_role public.user_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = _role
 AND u."deletedAt" IS NULL
 )
 $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql
 STABLE SECURITY DEFINER SET search_path TO ''
 AS $$ SELECT public.has_user_role('ADMIN'::public.user_role) $$;
CREATE FUNCTION public.my_dealer_profile_ids() RETURNS SETOF text LANGUAGE sql
 STABLE SECURITY DEFINER SET search_path TO ''
 AS $$
 SELECT dp.id FROM public.dealer_profiles dp WHERE dp."userId" = auth.uid()::text
 UNION SELECT ds."dealerProfileId" FROM public.dealer_staff ds
 WHERE ds."userId" = auth.uid()::text AND ds."isActive"
 $$;
CREATE FUNCTION public.owns_listing(_listing_id text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $$
 SELECT EXISTS (SELECT 1 FROM public.listings l
 WHERE l.id = _listing_id AND l."sellerId" = auth.uid()::text)
 $$;

-- Function default PUBLIC EXECUTE is an independent danger. Explicitly revoke;
-- grant only authenticated execution in synthetic CI.
REVOKE ALL ON FUNCTION public.current_uid(),
public.has_user_role(public.user_role),public.is_admin(),
public.my_dealer_profile_ids(),public.owns_listing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_uid(),
public.has_user_role(public.user_role),public.is_admin(),
public.my_dealer_profile_ids(),public.owns_listing(text) TO authenticated;
GRANT USAGE ON TYPE public.user_role TO authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

DO $$
DECLARE
 r record;
BEGIN
 IF has_schema_privilege('anon','public','CREATE') OR
    has_schema_privilege('authenticated','public','CREATE') OR
    NOT has_schema_privilege('anon','public','USAGE') OR
    NOT has_schema_privilege('authenticated','public','USAGE') THEN
  RAISE EXCEPTION 'Schema grant cutover failed in synthetic fixture';
 END IF;
 FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname IN ('current_uid','has_user_role','is_admin','my_dealer_profile_ids','owns_listing')
 LOOP
  IF has_function_privilege('anon',r.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Anon can invoke privileged helper';
  END IF;
  IF NOT has_function_privilege('authenticated',r.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Authenticated helper execution unexpectedly denied';
  END IF;
  IF (SELECT proconfig FROM pg_proc WHERE oid=r.oid) <> ARRAY['search_path=""']::text[] THEN
   RAISE EXCEPTION 'Security helper search_path must be empty';
  END IF;
 END LOOP;
END $$;

-- Authenticated users, staff dealers and admins exercise actual helper bodies
-- with synthetic fake JWTs, never production customer IDs.
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF public.current_uid() <> '11111111-1111-4111-8111-111111111111' OR
    public.is_admin() OR public.has_user_role('ADMIN'::public.user_role) OR
    NOT public.owns_listing('seller-listing') OR
    NOT ('dealer-01'=ANY(ARRAY(SELECT public.my_dealer_profile_ids()))) THEN
  RAISE EXCEPTION 'Buyer or active staff dealer synthetic helper failed';
 END IF;
END $$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
 IF NOT public.has_user_role('DEALER'::public.user_role) OR public.is_admin() OR
    public.owns_listing('seller-listing') OR
    NOT ('dealer-01'=ANY(ARRAY(SELECT public.my_dealer_profile_ids()))) THEN
  RAISE EXCEPTION 'Synthetic dealer permission result failed';
 END IF;
END $$;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
 IF NOT public.is_admin() OR NOT public.has_user_role('ADMIN'::public.user_role)
 THEN RAISE EXCEPTION 'Synthetic admin result failed'; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF NOT has_schema_privilege('anon','public','USAGE') THEN
  RAISE EXCEPTION 'Public schema USAGE broke after synthetic cutover';
 END IF;
END $$;
