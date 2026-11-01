-- Claim each incoming customer message at most once for AI generation.
-- A failed attempt is handed to human support rather than retried at model cost.
ALTER TABLE "messages" ADD COLUMN "aiSupportAttemptedAt" TIMESTAMP(3);
