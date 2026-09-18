WITH classified AS (
  SELECT
    cr.id,
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
  WHERE cr."deletedAt" IS NULL
    AND cr.context = 'LEGACY'::"chat_context"
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
SET context = r.resolved_context,
    "conversationKey" = r.resolved_key
FROM resolved r
WHERE cr.id = r.id;
