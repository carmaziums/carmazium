-- Store audit Block 4: AI response reporting and review queue.

DO $$ BEGIN
  CREATE TYPE "ai_report_reason" AS ENUM (
    'UNSAFE_OFFENSIVE',
    'INACCURATE_MISLEADING',
    'SCAM_DISHONEST',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ai_report_status" AS ENUM (
    'OPEN',
    'REVIEWING',
    'RESOLVED',
    'DISMISSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ai_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "surface" TEXT NOT NULL,
  "prompt" TEXT,
  "response" TEXT NOT NULL,
  "reason" "ai_report_reason" NOT NULL,
  "details" TEXT,
  "status" "ai_report_status" NOT NULL DEFAULT 'OPEN',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_reports_status_createdAt_idx"
  ON "ai_reports" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ai_reports_reason_createdAt_idx"
  ON "ai_reports" ("reason", "createdAt" DESC);
