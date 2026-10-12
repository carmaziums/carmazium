-- Disposable GitHub Actions database ONLY. Never execute on Supabase.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database() <> 'cm_core_ci' THEN
    RAISE EXCEPTION 'Core-schema fixture may run only in disposable cm_core_ci';
  END IF;
END $guard$;

CREATE ROLE cm_core_migrator LOGIN PASSWORD 'synthetic_migrator_ci_only'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE cm_core_runtime LOGIN PASSWORD 'synthetic_runtime_ci_only'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE cm_core_ci TO cm_core_migrator, cm_core_runtime;

-- Rehearse the observed live permission problem exclusively in disposable CI.
GRANT USAGE, CREATE ON SCHEMA public TO PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA cm_core AUTHORIZATION cm_core_migrator;
GRANT USAGE ON SCHEMA cm_core TO cm_core_runtime;
SET ROLE cm_core_migrator;
CREATE TYPE cm_core.listing_type AS ENUM ('AUCTION','CLASSIFIED');
CREATE TYPE cm_core.listing_status AS ENUM
  ('DRAFT','ACTIVE','SOLD','WITHDRAWN','OFFER_ACCEPTED','PENDING_REVIEW','REJECTED');
CREATE TYPE cm_core.auction_status AS ENUM
  ('SCHEDULED','ACTIVE','ENDED','CANCELLED');
CREATE TYPE cm_core.user_role AS ENUM
  ('ADMIN','BUYER','SELLER','DEALER','CONTRACTOR','FINANCE_PARTNER','INSURANCE_PARTNER');
CREATE TYPE cm_core.purchase_status AS ENUM
  ('AWAITING_CONFIRMATION','REVIEWING_DOCS','CHECKS_COMPLETE','DELIVERY_REQUESTED');
CREATE TYPE cm_core.transaction_type AS ENUM
  ('DEPOSIT','FULL_PAYMENT','COMMISSION','REFUND','HPI_REPORT','LISTING_FEE','BOOST','HPI_REPORT_EMAIL','KYC_VERIFICATION');
CREATE TYPE cm_core.transaction_status AS ENUM ('PENDING','COMPLETED','FAILED','REFUNDED');

-- Live-shaped SELECTED columns, not the full production schema. Exact names,
-- PG types, nullability and enum labels were inspected metadata-only.
CREATE TABLE cm_core.users (
  id text PRIMARY KEY, email text NOT NULL, "passwordHash" text NOT NULL,
  role cm_core.user_role NOT NULL
);
CREATE TABLE cm_core.listings (
  id text PRIMARY KEY, "sellerId" text REFERENCES cm_core.users(id),
  type cm_core.listing_type NOT NULL, status cm_core.listing_status NOT NULL,
  title text NOT NULL, price numeric NOT NULL, "deletedAt" timestamp
);
CREATE TABLE cm_core.auctions (
  id text PRIMARY KEY, "listingId" text NOT NULL REFERENCES cm_core.listings(id),
  "startTime" timestamp NOT NULL, "endTime" timestamp NOT NULL,
  "reservePrice" numeric NOT NULL, "startingBid" numeric NOT NULL,
  "minIncrement" numeric NOT NULL, status cm_core.auction_status NOT NULL,
  "buyerFeePaid" bool NOT NULL DEFAULT false,
  "sellerBonusReleased" bool NOT NULL DEFAULT false,
  "sellerFundsConfirmationRequired" bool NOT NULL DEFAULT true,
  "sellerFundsConfirmedAt" timestamp,
  "handoverRejectedAt" timestamp, "deletedAt" timestamp
);
CREATE TABLE cm_core.bids (
  id text PRIMARY KEY, "listingId" text NOT NULL REFERENCES cm_core.listings(id),
  "bidderId" text NOT NULL REFERENCES cm_core.users(id),
  amount numeric NOT NULL, "timestamp" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL, "updatedAt" timestamp NOT NULL,
  "deletedAt" timestamp, "cancelledAt" timestamp, "archivedAt" timestamp
);
CREATE TABLE cm_core.sales (
  id text PRIMARY KEY, "listingId" text NOT NULL REFERENCES cm_core.listings(id),
  "sellerId" text NOT NULL REFERENCES cm_core.users(id),
  "buyerId" text REFERENCES cm_core.users(id),
  "soldPrice" numeric NOT NULL, "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "purchaseStatus" cm_core.purchase_status NOT NULL
);
CREATE TABLE cm_core.transactions (
  id text PRIMARY KEY, "listingId" text REFERENCES cm_core.listings(id),
  "userId" text NOT NULL REFERENCES cm_core.users(id),
  amount numeric NOT NULL, type cm_core.transaction_type NOT NULL,
  status cm_core.transaction_status NOT NULL,
  "createdAt" timestamp NOT NULL, "updatedAt" timestamp NOT NULL,
  "deletedAt" timestamp
);
CREATE TABLE cm_core.sessions (
  sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp NOT NULL
);

-- Synthetic RLS policies are intentionally scoped and NOT production policy
-- replacements. Without a policy, sensitive rows must remain invisible.
ALTER TABLE cm_core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_core.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_core.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_core.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_core.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_public_listings ON cm_core.listings FOR SELECT
  TO cm_core_runtime USING (status = 'ACTIVE' AND "deletedAt" IS NULL);
CREATE POLICY synthetic_live_auctions ON cm_core.auctions FOR SELECT
  TO cm_core_runtime USING (
    status = 'ACTIVE' AND "deletedAt" IS NULL
    AND "startTime" <= NOW() AND "endTime" > NOW());
CREATE POLICY synthetic_bid_insert ON cm_core.bids FOR INSERT
  TO cm_core_runtime WITH CHECK (
    "deletedAt" IS NULL AND "cancelledAt" IS NULL AND "archivedAt" IS NULL
    AND EXISTS (SELECT 1 FROM cm_core.auctions a
                WHERE a."listingId" = bids."listingId"));
CREATE POLICY synthetic_bid_select ON cm_core.bids FOR SELECT
  TO cm_core_runtime USING ("deletedAt" IS NULL AND "cancelledAt" IS NULL);
CREATE POLICY synthetic_session_dml ON cm_core.sessions FOR ALL
  TO cm_core_runtime USING (true) WITH CHECK (true);

INSERT INTO cm_core.users VALUES
 ('test-seller','seller@example.invalid','SYNTHETIC-NOT-A-HASH','SELLER'),
 ('test-dealer','dealer@example.invalid','SYNTHETIC-NOT-A-HASH','DEALER');
INSERT INTO cm_core.listings VALUES
 ('live-listing','test-seller','AUCTION','ACTIVE','Synthetic active vehicle',8000,NULL),
 ('ended-listing','test-seller','AUCTION','SOLD','Synthetic ended vehicle',6000,NULL);
INSERT INTO cm_core.auctions
(id,"listingId","startTime","endTime","reservePrice","startingBid","minIncrement",status)
VALUES
('live-auction','live-listing',now()-interval '1 hour',now()+interval '1 hour',7900,7000,100,'ACTIVE'),
('ended-auction','ended-listing',now()-interval '2 hours',now()-interval '1 hour',6000,5000,100,'ENDED');
RESET ROLE;

-- A runtime account can read ONLY selected user columns (not passwords),
-- browse approved live stock, and place eligible bids. It cannot change
-- auction reserve/buyer-fee/handover financial fields or see ended stock.
GRANT USAGE ON TYPE cm_core.listing_type,cm_core.listing_status,
 cm_core.auction_status,cm_core.user_role,cm_core.purchase_status,
 cm_core.transaction_type,cm_core.transaction_status TO cm_core_runtime;
GRANT SELECT(id,role) ON cm_core.users TO cm_core_runtime;
GRANT SELECT ON cm_core.listings,cm_core.auctions TO cm_core_runtime;
GRANT SELECT,INSERT ON cm_core.bids TO cm_core_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON cm_core.sessions TO cm_core_runtime;
GRANT SELECT ON cm_core.sales TO cm_core_runtime;
-- Deliberately NO transaction-table grant, NO auction UPDATE,
-- NO SELECT of passwordHash, NO CREATE anywhere.
