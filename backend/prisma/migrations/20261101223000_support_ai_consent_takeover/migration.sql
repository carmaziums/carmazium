-- AI replies must never be sent without explicit consent, and a human takeover must persist.
ALTER TABLE "chat_rooms"
  ADD COLUMN "supportAiConsentAt" TIMESTAMP(3),
  ADD COLUMN "supportAiOptedOutAt" TIMESTAMP(3),
  ADD COLUMN "supportHumanTakeoverAt" TIMESTAMP(3);
