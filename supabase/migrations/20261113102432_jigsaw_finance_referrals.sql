-- Additive: apply before deploying the referral backend. No existing records are changed.
CREATE TABLE IF NOT EXISTS public.finance_referrals (
  id text PRIMARY KEY,
  "listingId" text NOT NULL,
  "sellerId" text NOT NULL,
  "listingTitle" text NOT NULL,
  "listingSlug" text NOT NULL,
  "fullName" text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  "consentVersion" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "adminNotifiedAt" timestamp(3),
  "notificationClaimedAt" timestamp(3)
);
CREATE INDEX IF NOT EXISTS "finance_referrals_adminNotifiedAt_createdAt_idx"
  ON public.finance_referrals ("adminNotifiedAt", "createdAt");
ALTER TABLE public.finance_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_referrals FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.finance_referrals IS 'Private backend-only contact records before Jigsaw redirect; not completed credit applications. Application retention: 90 days.';
