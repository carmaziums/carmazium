-- Strictly disposable GitHub Actions PostgreSQL 17 rehearsal only.
-- DO NOT execute this fixture or CREATE synthetic test roles on live Supabase.
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF current_database() <> 'cm_acl_ci' THEN
    RAISE EXCEPTION 'Refuse execution except ephemeral cm_acl_ci';
  END IF;
END $$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.partner_profiles (
 id text PRIMARY KEY,
 "financeUserId" text,
 "insuranceUserId" text,
 "partnerType" text,
 "companyName" text,
 "apiKey" text,
 "callbackUrl" text,
 "isActive" boolean DEFAULT true,
 "deletedAt" timestamp
);
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY partnerprofiles_read ON public.partner_profiles
 FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.partner_profiles(id,"partnerType","companyName","apiKey")
 VALUES ('synthetic-only','FINANCE','Fictional Partner','NEVER-A-LIVE-SECRET');

-- Exact pre-change role shape observed with metadata in live project:
GRANT SELECT ON public.partner_profiles TO anon, authenticated;
GRANT ALL ON public.partner_profiles TO service_role;
CREATE TABLE public.email_captures (id text PRIMARY KEY);
CREATE TABLE public.listings (id text PRIMARY KEY);
GRANT INSERT ON public.email_captures TO anon;
GRANT SELECT ON public.listings TO anon;

DO $$
BEGIN
 IF NOT has_column_privilege('anon','public.partner_profiles','apiKey','SELECT')
    OR NOT has_column_privilege('authenticated','public.partner_profiles','apiKey','SELECT')
    OR NOT has_table_privilege('service_role','public.partner_profiles','SELECT') THEN
  RAISE EXCEPTION 'Synthetic precondition did not reproduce vulnerable grant';
 END IF;
END $$;

-- Only the verified targeted containment applied live on 2026-10-03:
REVOKE SELECT ON TABLE public.partner_profiles FROM anon, authenticated;

DO $$
BEGIN
 IF has_table_privilege('anon','public.partner_profiles','SELECT') OR
    has_table_privilege('authenticated','public.partner_profiles','SELECT') OR
    has_column_privilege('anon','public.partner_profiles','apiKey','SELECT') OR
    has_column_privilege('authenticated','public.partner_profiles','apiKey','SELECT')
 THEN RAISE EXCEPTION 'Partner credential still readable by client role';
 END IF;
 IF NOT has_table_privilege('service_role','public.partner_profiles','SELECT')
   OR NOT has_table_privilege('anon','public.email_captures','INSERT')
   OR NOT has_table_privilege('anon','public.listings','SELECT')
 THEN RAISE EXCEPTION 'Critical service/public access unexpectedly disrupted';
 END IF;
END $$;
