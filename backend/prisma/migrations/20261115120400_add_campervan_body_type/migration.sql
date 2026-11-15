-- Add motorised campervans independently of towable caravans.
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'CAMPERVAN';
