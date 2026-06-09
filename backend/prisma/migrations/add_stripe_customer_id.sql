-- Add Stripe Customer ID to users table
-- Run: psql $DATABASE_URL -f prisma/migrations/add_stripe_customer_id.sql

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT UNIQUE;
