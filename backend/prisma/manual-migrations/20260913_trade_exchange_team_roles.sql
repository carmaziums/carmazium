-- TradeXchange dealer-team permissions and staff action audit.
-- Applied through Supabase migration tooling. Do not use prisma db push.

BEGIN;

CREATE TABLE IF NOT EXISTS public.trade_service_team_permissions (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "dealerProfileId" text NOT NULL REFERENCES public.dealer_profiles(id) ON DELETE CASCADE,
    "email" text NOT NULL,
    "deliveryEnabled" boolean NOT NULL DEFAULT false,
    "inspectionEnabled" boolean NOT NULL DEFAULT false,
    "canQuote" boolean NOT NULL DEFAULT false,
    "canManage" boolean NOT NULL DEFAULT false,
    "canComplete" boolean NOT NULL DEFAULT false,
    "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trade_service_team_permissions_email_lower CHECK ("email" = lower("email")),
    CONSTRAINT trade_service_team_permissions_unique UNIQUE ("dealerProfileId", "email")
);

CREATE INDEX IF NOT EXISTS trade_service_team_permissions_dealer_idx
    ON public.trade_service_team_permissions ("dealerProfileId");
CREATE INDEX IF NOT EXISTS trade_service_team_permissions_email_idx
    ON public.trade_service_team_permissions ("email");

CREATE TABLE IF NOT EXISTS public.trade_service_team_action_log (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "jobId" text NOT NULL REFERENCES public.service_jobs(id) ON DELETE CASCADE,
    "dealerProfileId" text NULL REFERENCES public.dealer_profiles(id) ON DELETE SET NULL,
    "contractorProfileId" text NOT NULL REFERENCES public.contractor_profiles(id) ON DELETE CASCADE,
    "actingUserId" text NULL REFERENCES public.users(id) ON DELETE SET NULL,
    "action" text NOT NULL,
    "metadata" jsonb NULL,
    "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS trade_service_team_action_log_job_idx
    ON public.trade_service_team_action_log ("jobId", "createdAt");
CREATE INDEX IF NOT EXISTS trade_service_team_action_log_actor_idx
    ON public.trade_service_team_action_log ("actingUserId", "createdAt");

ALTER TABLE public.trade_service_team_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_service_team_action_log ENABLE ROW LEVEL SECURITY;

-- The Nest backend performs owner/staff checks. These records are not exposed
-- directly through Supabase REST to browser roles.
REVOKE ALL ON TABLE public.trade_service_team_permissions FROM anon, authenticated;
REVOKE ALL ON TABLE public.trade_service_team_action_log FROM anon, authenticated;

COMMIT;
