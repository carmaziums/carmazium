-- Touring caravans use the CARAVAN body type and their VIN/CRiS identifier.
-- Additive, backwards-compatible enum extension. Deploy before application writes CARAVAN.
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'CARAVAN';
