-- Performance optimization: add missing indexes identified in perf audit
-- All statements use IF NOT EXISTS so they are safe to re-run

-- User: role and createdAt for analytics and role-based filtering
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("createdAt");

-- DealerKyc: KYC workflow admin queue lookups
CREATE INDEX IF NOT EXISTS "dealer_kycs_dealer_profile_id_idx" ON "dealer_kycs"("dealerProfileId");
CREATE INDEX IF NOT EXISTS "dealer_kycs_status_idx" ON "dealer_kycs"("status");

-- DealerInvite: invite listing and duplicate-check lookups
CREATE INDEX IF NOT EXISTS "dealer_invites_dealer_profile_id_idx" ON "dealer_invites"("dealerProfileId");
CREATE INDEX IF NOT EXISTS "dealer_invites_email_idx" ON "dealer_invites"("email");

-- ContractorProfile: lookup by userId
CREATE INDEX IF NOT EXISTS "contractor_profiles_user_id_idx" ON "contractor_profiles"("userId");

-- Listing: featured carousel (homepage) and recency sort
CREATE INDEX IF NOT EXISTS "listings_is_featured_status_featured_until_idx" ON "listings"("isFeatured", "status", "featuredUntil");
CREATE INDEX IF NOT EXISTS "listings_created_at_idx" ON "listings"("createdAt");

-- Auction: lifecycle cron activates scheduled auctions by startTime every minute
CREATE INDEX IF NOT EXISTS "auctions_start_time_idx" ON "auctions"("startTime");

-- Bid: buyer bid history ordered by recency
CREATE INDEX IF NOT EXISTS "bids_bidder_id_created_at_idx" ON "bids"("bidderId", "createdAt" DESC);

-- Message: efficient chat pagination (chatRoomId + time ordering)
CREATE INDEX IF NOT EXISTS "messages_chat_room_id_created_at_idx" ON "messages"("chatRoomId", "createdAt" DESC);

-- Offer: recent offers per listing and buyer's pending offers
CREATE INDEX IF NOT EXISTS "offers_listing_id_created_at_idx" ON "offers"("listingId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "offers_buyer_id_status_idx" ON "offers"("buyerId", "status");
