DO $$
BEGIN
  CREATE TYPE "chat_context" AS ENUM ('SUPPORT', 'RETAIL', 'AUCTION', 'DISPUTE', 'LEGACY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS context "chat_context",
  ADD COLUMN IF NOT EXISTS "conversationKey" text;

WITH classified AS (
  SELECT
    cr.id,
    cr."deletedAt",
    cr."listingId",
    cr."initiatorId",
    cr."participantId",
    l.type::text AS listing_type,
    a.id AS auction_id,
    ui.role::text AS initiator_role,
    up.role::text AS participant_role
  FROM public.chat_rooms cr
  JOIN public.users ui ON ui.id = cr."initiatorId"
  JOIN public.users up ON up.id = cr."participantId"
  LEFT JOIN public.listings l ON l.id = cr."listingId"
  LEFT JOIN public.auctions a ON a."listingId" = cr."listingId"
),
resolved AS (
  SELECT
    id,
    CASE
      WHEN "listingId" IS NOT NULL AND listing_type = 'AUCTION' THEN 'AUCTION'::"chat_context"
      WHEN "listingId" IS NOT NULL THEN 'RETAIL'::"chat_context"
      WHEN initiator_role = 'ADMIN' OR participant_role = 'ADMIN' THEN 'SUPPORT'::"chat_context"
      ELSE 'LEGACY'::"chat_context"
    END AS resolved_context,
    CASE
      WHEN "deletedAt" IS NOT NULL THEN 'ARCHIVED:' || id
      WHEN "listingId" IS NOT NULL AND listing_type = 'AUCTION' THEN
        'AUCTION:' || COALESCE(auction_id, "listingId") || ':' ||
        LEAST("initiatorId", "participantId") || ':' ||
        GREATEST("initiatorId", "participantId")
      WHEN "listingId" IS NOT NULL THEN
        'RETAIL:' || "listingId" || ':' ||
        LEAST("initiatorId", "participantId") || ':' ||
        GREATEST("initiatorId", "participantId")
      WHEN initiator_role = 'ADMIN' OR participant_role = 'ADMIN' THEN
        'SUPPORT:CARMAZIUM:' ||
        LEAST("initiatorId", "participantId") || ':' ||
        GREATEST("initiatorId", "participantId")
      ELSE 'LEGACY:' || id
    END AS resolved_key
  FROM classified
)
UPDATE public.chat_rooms cr
SET
  context = resolved.resolved_context,
  "conversationKey" = resolved.resolved_key
FROM resolved
WHERE cr.id = resolved.id;

WITH ranked AS (
  SELECT
    id,
    "conversationKey",
    FIRST_VALUE(id) OVER (
      PARTITION BY "conversationKey"
      ORDER BY "createdAt" ASC, id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY "conversationKey"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM public.chat_rooms
  WHERE "deletedAt" IS NULL
),
duplicates AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.messages m
SET "chatRoomId" = d.canonical_id
FROM duplicates d
WHERE m."chatRoomId" = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    "conversationKey",
    ROW_NUMBER() OVER (
      PARTITION BY "conversationKey"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM public.chat_rooms
  WHERE "deletedAt" IS NULL
)
UPDATE public.chat_rooms cr
SET
  "deletedAt" = COALESCE(cr."deletedAt", CURRENT_TIMESTAMP),
  "conversationKey" = 'ARCHIVED:' || cr.id
FROM ranked r
WHERE cr.id = r.id
  AND r.rn > 1;

ALTER TABLE public.chat_rooms
  ALTER COLUMN context SET NOT NULL,
  ALTER COLUMN "conversationKey" SET NOT NULL;

DROP INDEX IF EXISTS public."chat_rooms_initiatorId_participantId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "chat_rooms_conversationKey_key"
  ON public.chat_rooms ("conversationKey");

CREATE INDEX IF NOT EXISTS "chat_rooms_context_idx"
  ON public.chat_rooms (context);
