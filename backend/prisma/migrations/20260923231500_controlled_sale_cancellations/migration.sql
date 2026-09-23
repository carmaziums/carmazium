-- Private evidence bucket. Files are written with the server-side service role and
-- are only returned through short-lived signed URLs after authorization.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sale-cancellation-evidence',
  'sale-cancellation-evidence',
  FALSE,
  26214400,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Controlled post-purchase sale cancellation workflow.
-- Keeps the request/evidence audit trail separate from the Sale row, which may
-- be removed when a deal is successfully unwound.

ALTER TYPE "offer_status" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  CREATE TYPE "sale_cancellation_status" AS ENUM (
    'PENDING_COUNTERPARTY',
    'PENDING_ADMIN',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "sale_cancellation_reason" AS ENUM (
    'BUYER_CHANGED_MIND',
    'SELLER_UNABLE_TO_COMPLETE',
    'VEHICLE_FAULT',
    'VEHICLE_MISDESCRIBED',
    'VEHICLE_DAMAGED',
    'PAYMENT_ISSUE',
    'MUTUAL_AGREEMENT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sale_cancellation_requests" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL,
  "saleId" TEXT,
  "auctionId" TEXT,
  "offerId" TEXT,
  "buyerId" TEXT,
  "sellerId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "requestedByRole" TEXT NOT NULL,
  "reason" "sale_cancellation_reason" NOT NULL,
  "details" TEXT,
  "status" "sale_cancellation_status" NOT NULL DEFAULT 'PENDING_COUNTERPARTY',
  "evidenceRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "counterpartRespondedById" TEXT,
  "counterpartResponseNote" TEXT,
  "counterpartRespondedAt" TIMESTAMP(3),
  "adminReviewedById" TEXT,
  "adminNote" TEXT,
  "buyerFeeRefunded" BOOLEAN NOT NULL DEFAULT FALSE,
  "sellerBonusRecoveryRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "sale_cancellation_evidence" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_cancellation_evidence_requestId_fkey"
    FOREIGN KEY ("requestId")
    REFERENCES "sale_cancellation_requests"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "sale_cancellation_requests_listingId_status_idx"
  ON "sale_cancellation_requests"("listingId", "status");
CREATE INDEX IF NOT EXISTS "sale_cancellation_requests_sellerId_status_idx"
  ON "sale_cancellation_requests"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "sale_cancellation_requests_buyerId_status_idx"
  ON "sale_cancellation_requests"("buyerId", "status");
CREATE INDEX IF NOT EXISTS "sale_cancellation_requests_requestedById_status_idx"
  ON "sale_cancellation_requests"("requestedById", "status");
CREATE INDEX IF NOT EXISTS "sale_cancellation_requests_status_createdAt_idx"
  ON "sale_cancellation_requests"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "sale_cancellation_evidence_requestId_idx"
  ON "sale_cancellation_evidence"("requestId");
CREATE INDEX IF NOT EXISTS "sale_cancellation_evidence_uploadedById_idx"
  ON "sale_cancellation_evidence"("uploadedById");


-- These audit tables are server-only. Keep them protected from the exposed
-- Supabase Data API; the Nest backend authorizes access and returns signed
-- evidence links.
ALTER TABLE "sale_cancellation_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_cancellation_evidence" ENABLE ROW LEVEL SECURITY;
