DO $$ BEGIN
  CREATE TYPE "inspection_outcome" AS ENUM ('PASS', 'FAULTS_FOUND');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "service_jobs"
  ADD COLUMN IF NOT EXISTS "inspectionOutcome" "inspection_outcome",
  ADD COLUMN IF NOT EXISTS "inspectionSummary" text;

ALTER TABLE "auctions"
  ADD COLUMN IF NOT EXISTS "buyerRefusedAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "buyerRefusedById" text,
  ADD COLUMN IF NOT EXISTS "buyerRefusalReason" text,
  ADD COLUMN IF NOT EXISTS "buyerRefusalInspectionJobId" text;
