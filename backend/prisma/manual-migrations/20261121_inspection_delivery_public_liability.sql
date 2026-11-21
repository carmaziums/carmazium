-- Mandatory Public Liability for collection/delivery/recovery and all inspection providers.
-- Run before deploying backend that refers to PUBLIC_LIABILITY_INSURANCE and evidenceCoverAmountGbp.
ALTER TABLE public.service_case_entries
  ADD COLUMN IF NOT EXISTS "evidenceCoverAmountGbp" INTEGER;
ALTER TABLE public.service_case_entries
  DROP CONSTRAINT IF EXISTS service_case_entries_evidence_type_check;
ALTER TABLE public.service_case_entries
  ADD CONSTRAINT service_case_entries_evidence_type_check CHECK (
    "evidenceType" IS NULL OR "evidenceType" IN (
      'BUSINESS_IDENTITY','DELIVERY_BUSINESS_INSURANCE','DELIVERY_GOODS_IN_TRANSIT',
      'INSPECTION_BUSINESS_INSURANCE','INSPECTION_QUALIFICATION',
      'PUBLIC_LIABILITY_INSURANCE','FINANCE_REGULATORY_AUTHORITY',
      'WARRANTY_REGULATORY_AUTHORITY','WARRANTY_PRODUCT_AUTHORITY'
    )
  ) NOT VALID;
ALTER TABLE public.service_case_entries
  VALIDATE CONSTRAINT service_case_entries_evidence_type_check;
ALTER TABLE public.service_case_entries
  ADD CONSTRAINT service_case_entries_insurance_cover_positive
    CHECK ("evidenceCoverAmountGbp" IS NULL OR "evidenceCoverAmountGbp" > 0) NOT VALID;
ALTER TABLE public.service_case_entries
  VALIDATE CONSTRAINT service_case_entries_insurance_cover_positive;
-- Explicitly recheck older verified capabilities before allowing fresh jobs.
-- Existing paid / accepted jobs continue under their recorded terms.
UPDATE public.contractor_capabilities
SET "verificationStatus" = 'REVERIFICATION_REQUIRED',
    "verificationExpiresAt" = NULL,
    "verificationReminder30SentAt" = NULL,
    "verificationReminder7SentAt" = NULL
WHERE "serviceType" IN ('DELIVERY','INSPECTION')
  AND "verificationStatus" = 'VERIFIED'
  AND NOT EXISTS (
    SELECT 1 FROM public.service_case_entries e
    WHERE e."scope" = 'CAPABILITY'
      AND e."evidenceType" = 'PUBLIC_LIABILITY_INSURANCE'
      AND e."evidenceStatus" = 'APPROVED'
      AND e."evidenceExpiresAt" > CURRENT_TIMESTAMP
      AND e."evidenceCoverAmountGbp" > 0
      AND e."entityId" IN (SELECT cc2.id FROM public.contractor_capabilities cc2
        WHERE cc2."contractorId" = public.contractor_capabilities."contractorId")
  );
