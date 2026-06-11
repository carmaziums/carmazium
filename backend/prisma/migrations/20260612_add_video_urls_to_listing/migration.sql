-- AddColumn: video embed URLs for listings (YouTube, Instagram, Facebook, X)
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "videoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
