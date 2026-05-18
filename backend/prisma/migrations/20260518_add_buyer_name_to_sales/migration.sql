-- AlterTable: add optional buyerName column to sales
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "buyerName" TEXT;
