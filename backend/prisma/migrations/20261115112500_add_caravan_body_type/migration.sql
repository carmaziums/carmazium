-- Add touring caravans to both retail and auction listing body types.
-- PostgreSQL enum additions are additive and preserve all existing vehicle records.
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'CARAVAN';
