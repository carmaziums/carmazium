-- Admin-only entitlement store for one complimentary BASIC retail listing.
--
-- This is intentionally a manual migration. backend/fly.toml documents that
-- production schema changes are applied explicitly against Supabase because
-- the production database contains TradeXchange tables that are not wholly
-- represented by schema.prisma. Never replace this with prisma db push.

CREATE TABLE IF NOT EXISTS public.admin_free_listing_grants (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES public.users("id") ON DELETE CASCADE,
    "grantedById" TEXT NOT NULL REFERENCES public.users("id") ON DELETE RESTRICT,
    "expiresAt" TIMESTAMPTZ NULL,
    "usedAt" TIMESTAMPTZ NULL,
    "usedListingId" TEXT NULL REFERENCES public.listings("id") ON DELETE SET NULL,
    "revokedAt" TIMESTAMPTZ NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_free_listing_grants_expires_idx
    ON public.admin_free_listing_grants ("expiresAt");

CREATE INDEX IF NOT EXISTS admin_free_listing_grants_status_idx
    ON public.admin_free_listing_grants ("usedAt", "revokedAt");

-- The browser must never be able to manufacture its own grant through
-- Supabase/PostgREST. The Nest backend connects directly to Postgres and is the
-- only code path that creates, revokes or consumes these rows.
ALTER TABLE public.admin_free_listing_grants ENABLE ROW LEVEL SECURITY;
