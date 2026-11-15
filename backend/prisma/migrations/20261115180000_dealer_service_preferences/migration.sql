-- Existing explicit finance/warranty preferences are retained.
ALTER TABLE "dealer_profiles" ALTER COLUMN "financeOffered" SET DEFAULT true;
ALTER TABLE "dealer_profiles" ALTER COLUMN "warrantyOffered" SET DEFAULT true;
ALTER TABLE "dealer_profiles" ADD COLUMN "deliveryServicesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "dealer_profiles" ADD COLUMN "inspectionServicesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "contractor_capabilities" ADD COLUMN "providerDeclaration" JSONB;
