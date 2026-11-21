-- Execute before deploying the Partner Agreement API and business activity gates.
-- Immutable, append-only legal event ledger. Application roles and RLS must
-- prevent normal users from altering or removing a signed event.
CREATE TABLE IF NOT EXISTS public.partner_agreement_acceptances (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "actorUserId" TEXT NOT NULL,
  "businessOwnerUserId" TEXT NOT NULL,
  "legalEntityName" TEXT NOT NULL,
  "businessKind" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "signatoryFullName" TEXT NOT NULL,
  "signatoryCapacity" TEXT NOT NULL,
  "agreementVersion" TEXT NOT NULL,
  "agreementSha256" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL,
  "userAgent" TEXT,
  "pseudonymousIpHash" TEXT,
  "authorityConfirmed" BOOLEAN NOT NULL DEFAULT TRUE,
  "explicitAcceptance" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT partner_agreement_kind CHECK ("businessKind" IN ('COMPANY','SOLE_TRADER','PARTNERSHIP','OTHER_BUSINESS')),
  CONSTRAINT partner_agreement_intent CHECK ("authorityConfirmed" AND "explicitAcceptance"),
  CONSTRAINT partner_agreement_sha CHECK ("agreementSha256" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS partner_agreement_owner_version_idx
 ON public.partner_agreement_acceptances ("businessOwnerUserId","agreementVersion","acceptedAt" DESC);
CREATE INDEX IF NOT EXISTS partner_agreement_actor_idx
 ON public.partner_agreement_acceptances ("actorUserId","acceptedAt" DESC);
ALTER TABLE public.partner_agreement_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_agreement_acceptances FROM anon, authenticated;
-- The server's privileged database role alone reads/writes acceptance events.
-- Do not grant browser clients direct INSERT, UPDATE or DELETE privileges.
