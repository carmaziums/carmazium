-- Keep the windows of Free Purchase Grants that an admin has replaced.
--
-- NOT YET APPLIED ANYWHERE. Apply by hand with the owner's approval. The
-- backend reads this table only if it exists, so the code can ship first.
--
-- Owner rule: eligibility for the £125 waiver is decided when the auction is
-- won. admin_free_purchase_grants has one row per user and re-granting
-- overwrites it (ON CONFLICT ("userId") DO UPDATE), which used to erase the
-- earlier window. This trigger copies the replaced row here first, so a win
-- made under the earlier grant still keeps its waiver if it is processed
-- late. A replaced window ends when it was replaced (or when it was revoked,
-- if earlier). Additive only; existing rows and grants are unchanged.

CREATE TABLE IF NOT EXISTS public.admin_free_purchase_grant_history (
    "id" TEXT PRIMARY KEY,                -- the replaced grant's id
    "userId" TEXT NOT NULL REFERENCES public.users("id") ON DELETE CASCADE,
    "grantedById" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ NULL,
    "revokedAt" TIMESTAMPTZ NULL,         -- revocation, or replacement time
    "useCount" INTEGER NOT NULL DEFAULT 0 CHECK ("useCount" >= 0),
    "replacedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "admin_free_purchase_grant_history_userId_startedAt_idx"
    ON public.admin_free_purchase_grant_history ("userId", "startedAt");

ALTER TABLE public.admin_free_purchase_grant_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.archive_replaced_free_purchase_grant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF OLD."id" IS DISTINCT FROM NEW."id" THEN
        INSERT INTO public.admin_free_purchase_grant_history (
            "id", "userId", "grantedById", "startedAt", "expiresAt",
            "revokedAt", "useCount", "replacedAt"
        ) VALUES (
            OLD."id", OLD."userId", OLD."grantedById", OLD."createdAt", OLD."expiresAt",
            COALESCE(OLD."revokedAt", NOW()), OLD."useCount", NOW()
        )
        ON CONFLICT ("id") DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS archive_replaced_free_purchase_grant ON public.admin_free_purchase_grants;
CREATE TRIGGER archive_replaced_free_purchase_grant
    BEFORE UPDATE ON public.admin_free_purchase_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.archive_replaced_free_purchase_grant();
