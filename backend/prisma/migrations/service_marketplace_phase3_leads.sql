-- Trade Exchange service marketplace — Phase 3: Finance + Warranty leads
--
-- Additive only. Finance and Warranty are enquiry services: there is no
-- CarMazium checkout, escrow, 9% fee or provider payout on these rows.
-- Delivery and Inspection continue to use service_jobs/service_quotes/payments.
--
-- Apply with a reviewed migration step. NEVER use prisma db push for this repo.

CREATE TABLE IF NOT EXISTS "service_leads" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "customerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "serviceType" service_type NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "listingId" TEXT REFERENCES "listings"("id") ON DELETE SET NULL,

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

    -- Finance enquiry fields
    "depositPence" INTEGER,
    "termMonths" INTEGER,
    "monthlyBudgetPence" INTEGER,
    "employmentStatus" TEXT,
    "annualIncomePence" INTEGER,

    -- Warranty enquiry fields
    "warrantyMonths" INTEGER,
    "warrantyLevel" TEXT,

    "consentToProviderContact" BOOLEAN NOT NULL DEFAULT FALSE,
    "consentRecordedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_leads_type_check"
      CHECK ("serviceType"::text IN ('FINANCE', 'WARRANTY')),
    CONSTRAINT "service_leads_status_check"
      CHECK ("status" IN ('OPEN', 'CLOSED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT "service_leads_vehicle_year_check"
      CHECK ("vehicleYear" IS NULL OR "vehicleYear" BETWEEN 1900 AND 2100),
    CONSTRAINT "service_leads_nonnegative_check"
      CHECK (
        ("vehicleMileage" IS NULL OR "vehicleMileage" >= 0) AND
        ("vehicleValuePence" IS NULL OR "vehicleValuePence" >= 0) AND
        ("depositPence" IS NULL OR "depositPence" >= 0) AND
        ("monthlyBudgetPence" IS NULL OR "monthlyBudgetPence" >= 0) AND
        ("annualIncomePence" IS NULL OR "annualIncomePence" >= 0)
      )
);

CREATE TABLE IF NOT EXISTS "service_lead_recipients" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "leadId" TEXT NOT NULL REFERENCES "service_leads"("id") ON DELETE CASCADE,
    "contractorId" TEXT NOT NULL REFERENCES "contractor_profiles"("id") ON DELETE CASCADE,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_lead_recipients_status_check"
      CHECK ("status" IN ('NEW', 'VIEWED', 'RESPONDED', 'DECLINED', 'CLOSED')),
    CONSTRAINT "service_lead_recipients_price_check"
      CHECK ("indicativePricePence" IS NULL OR "indicativePricePence" >= 0),
    CONSTRAINT "service_lead_recipients_apr_check"
      CHECK ("representativeApr" IS NULL OR ("representativeApr" >= 0 AND "representativeApr" <= 100)),
    CONSTRAINT "service_lead_recipients_unique" UNIQUE ("leadId", "contractorId")
);

-- These rows include customer contact details and finance preferences. The
-- public Supabase/PostgREST surface must never read them directly. The Nest
-- backend uses the database owner connection and applies the service-specific
-- authorization rules before returning data.
ALTER TABLE "service_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_lead_recipients" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "service_leads_customer_status_idx"
    ON "service_leads" ("customerId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "service_leads_type_status_idx"
    ON "service_leads" ("serviceType", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "service_leads_expiry_idx"
    ON "service_leads" ("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "service_lead_recipients_contractor_status_idx"
    ON "service_lead_recipients" ("contractorId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "service_lead_recipients_lead_idx"
    ON "service_lead_recipients" ("leadId", "createdAt");
