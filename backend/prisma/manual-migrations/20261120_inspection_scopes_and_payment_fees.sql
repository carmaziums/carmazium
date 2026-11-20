-- Add specialties inside the existing TradeXchange INSPECTION capability.
-- Run BEFORE deploying Prisma clients/code using these columns.
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS "inspectionScope" TEXT;
UPDATE public.service_jobs SET "inspectionScope" = 'VEHICLE'
WHERE "serviceType" = 'INSPECTION' AND "inspectionScope" IS NULL;
ALTER TABLE public.contractor_capabilities ADD COLUMN IF NOT EXISTS "inspectionScopes" TEXT[] NOT NULL DEFAULT ARRAY['VEHICLE']::text[];
ALTER TABLE public.service_payments ADD COLUMN IF NOT EXISTS "processingFeePence" INTEGER NOT NULL DEFAULT 0;
-- Do not change historical paid/settled amounts; fee pass-through applies on new releases.
