-- Purchase-time listing snapshots and dealer inspection notes.
--
-- NOT YET APPLIED ANYWHERE. Apply by hand, with the owner's approval, before
-- setting PURCHASE_SNAPSHOTS_ENABLED=true and PURCHASE_SNAPSHOTS_ENABLED_AT
-- (the switch-on time, ISO 8601) on the backend. The retry sweep only covers
-- sales recorded after PURCHASE_SNAPSHOTS_ENABLED_AT. Until that flag is
-- set the backend never reads or writes these tables, so deploying the code
-- first is safe. Additive only: no existing table or row is changed.
--
-- No foreign keys on purpose: a snapshot must survive later listing edits,
-- soft deletion and an approved sale cancellation (which deletes the Sale).

CREATE TABLE IF NOT EXISTS "purchase_listing_snapshots" (
  "id"         TEXT PRIMARY KEY,
  "saleId"     TEXT NOT NULL,
  "listingId"  TEXT NOT NULL,
  "buyerId"    TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data"       JSONB NOT NULL
);
-- One snapshot per Sale; a repeat purchase after a cancellation is a new Sale.
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_listing_snapshots_saleId_key"
  ON "purchase_listing_snapshots" ("saleId");
CREATE INDEX IF NOT EXISTS "purchase_listing_snapshots_listingId_buyerId_idx"
  ON "purchase_listing_snapshots" ("listingId", "buyerId");

CREATE TABLE IF NOT EXISTS "purchase_inspection_notes" (
  "id"          TEXT PRIMARY KEY,
  "listingId"   TEXT NOT NULL,
  "buyerId"     TEXT NOT NULL,
  "saleId"      TEXT NOT NULL,
  "authorId"    TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "part"        TEXT,
  "description" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "purchase_inspection_notes_listingId_buyerId_idx"
  ON "purchase_inspection_notes" ("listingId", "buyerId");
CREATE INDEX IF NOT EXISTS "purchase_inspection_notes_saleId_idx"
  ON "purchase_inspection_notes" ("saleId");

-- The backend reaches these through Prisma with the service role. Block the
-- public Supabase API entirely (no policies = no anon/authenticated access).
ALTER TABLE public.purchase_listing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_inspection_notes ENABLE ROW LEVEL SECURITY;
