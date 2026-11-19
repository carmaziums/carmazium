-- Guest contact details are read only through the authorized backend inbox.
-- Prisma's server database role owns this table; browser roles get no access.
ALTER TABLE "public"."guest_listing_enquiries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."guest_listing_enquiries" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "public"."guest_listing_enquiries" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "public"."guest_listing_enquiries" FROM authenticated;
  END IF;
END $$;
