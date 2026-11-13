CREATE TABLE "warranty_orders" (
 "id" TEXT PRIMARY KEY, "userId" TEXT, "listingId" TEXT,
 "accessTokenHash" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
 "customer" JSONB NOT NULL, "vehicle" JSONB NOT NULL, "selection" JSONB NOT NULL, "price" JSONB NOT NULL,
 "totalPence" INTEGER NOT NULL CHECK ("totalPence" > 0), "currency" TEXT NOT NULL DEFAULT 'gbp',
 "tariffVersion" TEXT NOT NULL, "consentVersion" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUOTED' CHECK ("status" IN ('QUOTED','CHECKOUT_PENDING','PAID_AWAITING_ISSUE','ISSUED','PAYMENT_FAILED','EXPIRED','REFUND_PENDING','REFUNDED','PAYMENT_REVIEW')),
 "expiresAt" TIMESTAMP(3) NOT NULL, "stripeAccountId" TEXT, "checkoutExpiresAt" TIMESTAMP(3),
 "stripeCheckoutSessionId" TEXT UNIQUE, "stripePaymentIntentId" TEXT UNIQUE, "stripeRefundId" TEXT UNIQUE,
 "refundReason" TEXT, "refundRequestedBy" TEXT, "paymentReviewReason" TEXT,
 "paidAt" TIMESTAMP(3), "issuedAt" TIMESTAMP(3), "issuedBy" TEXT, "warrantyReference" TEXT,
 "coverStart" TIMESTAMP(3), "coverEnd" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "warranty_orders_status_createdAt_idx" ON "warranty_orders" ("status", "createdAt");
CREATE INDEX "warranty_orders_userId_createdAt_idx" ON "warranty_orders" ("userId", "createdAt");
CREATE TABLE "warranty_order_messages" (
 "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "warranty_orders"("id") ON DELETE CASCADE,
 "kind" TEXT NOT NULL, "email" TEXT NOT NULL, "userId" TEXT, "subject" TEXT NOT NULL, "bodyHtml" TEXT NOT NULL,
 "sentAt" TIMESTAMP(3), "claimedAt" TIMESTAMP(3), "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("orderId", "kind", "email")
);
CREATE INDEX "warranty_order_messages_sentAt_nextAttemptAt_idx" ON "warranty_order_messages" ("sentAt", "nextAttemptAt");
-- All access is through the authenticated backend or an unguessable, hashed order token.
ALTER TABLE "warranty_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warranty_order_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "warranty_orders", "warranty_order_messages" FROM anon, authenticated;
