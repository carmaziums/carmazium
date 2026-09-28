-- Admin-controlled fee-free auction purchase grants.
--
-- This table intentionally lives outside Prisma's generated schema. Production
-- schema changes are applied explicitly against Supabase and the backend is the
-- only reader/writer. No browser RLS policies are created.
--
-- A grant is reusable for every auction win that occurs while the grant is
-- active. expiresAt = NULL means the entitlement remains active until revoked.

CREATE TABLE IF NOT EXISTS public.admin_free_purchase_grants (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES public.users("id") ON DELETE CASCADE,
    "grantedById" TEXT NOT NULL REFERENCES public.users("id") ON DELETE RESTRICT,
    "expiresAt" TIMESTAMPTZ NULL,
    "revokedAt" TIMESTAMPTZ NULL,
    "lastUsedAt" TIMESTAMPTZ NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0 CHECK ("useCount" >= 0),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "admin_free_purchase_grants_expiresAt_idx"
    ON public.admin_free_purchase_grants ("expiresAt");

CREATE INDEX IF NOT EXISTS "admin_free_purchase_grants_revokedAt_idx"
    ON public.admin_free_purchase_grants ("revokedAt");

ALTER TABLE public.admin_free_purchase_grants ENABLE ROW LEVEL SECURITY;
