-- TradeXchange admin operations: provider verification attachments and dispute case history.
-- Applied manually through Supabase migration tooling. Do not use prisma db push.

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_case_entries (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "scope" text NOT NULL CHECK ("scope" IN ('CAPABILITY', 'DISPUTE')),
    "entityId" text NOT NULL,
    "submittedById" text NULL REFERENCES public.users(id) ON DELETE SET NULL,
    "kind" text NOT NULL CHECK ("kind" IN ('DOCUMENT', 'PHOTO', 'NOTE', 'RESOLUTION')),
    "label" text NULL,
    "url" text NULL,
    "note" text NULL,
    "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_case_entries_content_check CHECK (
        NULLIF(BTRIM(COALESCE("url", '')), '') IS NOT NULL
        OR NULLIF(BTRIM(COALESCE("note", '')), '') IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS service_case_entries_scope_entity_idx
    ON public.service_case_entries ("scope", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS service_case_entries_submitted_by_idx
    ON public.service_case_entries ("submittedById");

ALTER TABLE public.service_case_entries ENABLE ROW LEVEL SECURITY;

-- All reads/writes go through the authenticated Nest backend, which performs
-- ownership/admin checks. Do not expose these case records directly through
-- Supabase's anon/authenticated REST roles.
REVOKE ALL ON TABLE public.service_case_entries FROM anon, authenticated;

COMMIT;
