CREATE TABLE "guest_listing_enquiries" (
 "id" TEXT NOT NULL, "listingId" TEXT NOT NULL, "sellerId" TEXT NOT NULL,
 "fullName" TEXT NOT NULL, "email" TEXT NOT NULL, "phone" TEXT, "message" TEXT NOT NULL,
 "codeHash" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL,
 "consentVersion" TEXT NOT NULL, "verifiedAt" TIMESTAMP(3), "notifiedAt" TIMESTAMP(3),
 "notificationClaimedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "guest_listing_enquiries_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "guest_listing_enquiries_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "guest_listing_enquiries_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "guest_listing_enquiries_email_createdAt_idx" ON "guest_listing_enquiries"("email", "createdAt");
CREATE INDEX "guest_listing_enquiries_sellerId_verifiedAt_idx" ON "guest_listing_enquiries"("sellerId", "verifiedAt");
CREATE INDEX "guest_listing_enquiries_notifiedAt_verifiedAt_idx" ON "guest_listing_enquiries"("notifiedAt", "verifiedAt");
