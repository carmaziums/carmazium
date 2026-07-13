-- Digest: seller-authored custom tags/batch labels + self-rating on their own auction listing.
-- customTags defaults to an empty array; sellerSelfRating is nullable (1-5 scale, enforced at DTO level).
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "customTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "sellerSelfRating" INTEGER;
