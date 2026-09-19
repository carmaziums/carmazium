-- Adopt Finance + Warranty enquiry tables into the Prisma-managed schema.
--
-- Production already received the equivalent Supabase migration on 2026-09-12.
-- This migration is intentionally idempotent:
--   * existing tables/data are preserved;
--   * missing tables are created;
--   * expected constraints/indexes/RLS are ensured;
--   * nothing is dropped or rewritten.
--
-- Do not replace this with prisma db push. The wider production database still
-- has mixed Prisma/Supabase migration history and must be reconciled separately.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'service_type'
  ) THEN
    CREATE TYPE public.service_type AS ENUM ('DELIVERY', 'INSPECTION', 'FINANCE', 'WARRANTY');
  END IF;
END $$;

ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'DELIVERY';
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'INSPECTION';
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'WARRANTY';

CREATE TABLE IF NOT EXISTS public.service_leads (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "customerId" TEXT NOT NULL REFERENCES public.users("id") ON DELETE CASCADE,
    "serviceType" public.service_type NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "listingId" TEXT REFERENCES public.listings("id") ON DELETE SET NULL,

    "vehicleRegistration" TEXT,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "vehicleYear" INTEGER,
    "vehicleMileage" INTEGER,
    "vehicleValuePence" INTEGER,

    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "postcode" TEXT,
    "summary" TEXT,

    "depositPence" INTEGER,
    "termMonths" INTEGER,
    "monthlyBudgetPence" INTEGER,
    "employmentStatus" TEXT,
    "annualIncomePence" INTEGER,

    "warrantyMonths" INTEGER,
    "warrantyLevel" TEXT,

    "consentToProviderContact" BOOLEAN NOT NULL DEFAULT FALSE,
    "consentRecordedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.service_lead_recipients (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "leadId" TEXT NOT NULL REFERENCES public.service_leads("id") ON DELETE CASCADE,
    "contractorId" TEXT NOT NULL REFERENCES public.contractor_profiles("id") ON DELETE CASCADE,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "headline" TEXT,
    "message" TEXT,
    "productName" TEXT,
    "indicativePricePence" INTEGER,
    "representativeApr" DECIMAL(6,3),
    "termMonths" INTEGER,
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_leads_pkey'
      AND conrelid = 'public.service_leads'::regclass
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT service_leads_pkey PRIMARY KEY ("id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_leads_customerId_fkey'
      AND conrelid = 'public.service_leads'::regclass
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT "service_leads_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES public.users("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_leads_listingId_fkey'
      AND conrelid = 'public.service_leads'::regclass
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT "service_leads_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES public.listings("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_leads_type_check'
      AND conrelid = 'public.service_leads'::regclass
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT service_leads_type_check
      CHECK ("serviceType"::text IN ('FINANCE', 'WARRANTY'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_leads_status_check'
      AND conrelid = 'public.service_leads'::regclass
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT service_leads_status_check
      CHECK ("status" IN ('OPEN', 'CLOSED', 'CANCELLED', 'EXPIRED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_leads_vehicle_year_check'
      AND conrelid = 'public.service_leads'::regclass
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT service_leads_vehicle_year_check
      CHECK ("vehicleYear" IS NULL OR "vehicleYear" BETWEEN 1900 AND 2100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_leads_nonnegative_check'
      AND conrelid = 'public.service_leads'::regclass
  ) THEN
    ALTER TABLE public.service_leads
      ADD CONSTRAINT service_leads_nonnegative_check
      CHECK (
        ("vehicleMileage" IS NULL OR "vehicleMileage" >= 0) AND
        ("vehicleValuePence" IS NULL OR "vehicleValuePence" >= 0) AND
        ("depositPence" IS NULL OR "depositPence" >= 0) AND
        ("monthlyBudgetPence" IS NULL OR "monthlyBudgetPence" >= 0) AND
        ("annualIncomePence" IS NULL OR "annualIncomePence" >= 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_lead_recipients_pkey'
      AND conrelid = 'public.service_lead_recipients'::regclass
  ) THEN
    ALTER TABLE public.service_lead_recipients
      ADD CONSTRAINT service_lead_recipients_pkey PRIMARY KEY ("id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_lead_recipients_leadId_fkey'
      AND conrelid = 'public.service_lead_recipients'::regclass
  ) THEN
    ALTER TABLE public.service_lead_recipients
      ADD CONSTRAINT "service_lead_recipients_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES public.service_leads("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_lead_recipients_contractorId_fkey'
      AND conrelid = 'public.service_lead_recipients'::regclass
  ) THEN
    ALTER TABLE public.service_lead_recipients
      ADD CONSTRAINT "service_lead_recipients_contractorId_fkey"
      FOREIGN KEY ("contractorId") REFERENCES public.contractor_profiles("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_lead_recipients_status_check'
      AND conrelid = 'public.service_lead_recipients'::regclass
  ) THEN
    ALTER TABLE public.service_lead_recipients
      ADD CONSTRAINT service_lead_recipients_status_check
      CHECK ("status" IN ('NEW', 'VIEWED', 'RESPONDED', 'DECLINED', 'CLOSED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_lead_recipients_price_check'
      AND conrelid = 'public.service_lead_recipients'::regclass
  ) THEN
    ALTER TABLE public.service_lead_recipients
      ADD CONSTRAINT service_lead_recipients_price_check
      CHECK ("indicativePricePence" IS NULL OR "indicativePricePence" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_lead_recipients_apr_check'
      AND conrelid = 'public.service_lead_recipients'::regclass
  ) THEN
    ALTER TABLE public.service_lead_recipients
      ADD CONSTRAINT service_lead_recipients_apr_check
      CHECK ("representativeApr" IS NULL OR ("representativeApr" >= 0 AND "representativeApr" <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_lead_recipients_unique'
      AND conrelid = 'public.service_lead_recipients'::regclass
  ) THEN
    ALTER TABLE public.service_lead_recipients
      ADD CONSTRAINT service_lead_recipients_unique UNIQUE ("leadId", "contractorId");
  END IF;
END $$;

ALTER TABLE public.service_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_lead_recipients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS service_leads_customer_status_idx
    ON public.service_leads ("customerId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS service_leads_type_status_idx
    ON public.service_leads ("serviceType", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS service_leads_expiry_idx
    ON public.service_leads ("status", "expiresAt");
CREATE INDEX IF NOT EXISTS service_lead_recipients_contractor_status_idx
    ON public.service_lead_recipients ("contractorId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS service_lead_recipients_lead_idx
    ON public.service_lead_recipients ("leadId", "createdAt");

COMMIT;
