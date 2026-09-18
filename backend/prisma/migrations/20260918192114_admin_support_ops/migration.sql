DO $$
BEGIN
  CREATE TYPE public.broadcast_campaign_status AS ENUM ('SENDING','COMPLETED','PARTIAL','FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.broadcast_delivery_status AS ENUM ('PENDING','SENT','FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS "supportAssignedAdminId" text,
  ADD COLUMN IF NOT EXISTS "supportTags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS "supportClosedAt" timestamp(3);

WITH support_rows AS (
  SELECT
    cr.id,
    CASE
      WHEN iu.role = 'ADMIN'::user_role THEN cr."participantId"
      WHEN pu.role = 'ADMIN'::user_role THEN cr."initiatorId"
      ELSE NULL
    END AS customer_id,
    CASE
      WHEN iu.role = 'ADMIN'::user_role THEN cr."initiatorId"
      WHEN pu.role = 'ADMIN'::user_role THEN cr."participantId"
      ELSE NULL
    END AS admin_id
  FROM public.chat_rooms cr
  JOIN public.users iu ON iu.id = cr."initiatorId"
  JOIN public.users pu ON pu.id = cr."participantId"
  WHERE cr.context = 'SUPPORT'::chat_context
)
UPDATE public.chat_rooms cr
SET
  "conversationKey" = 'SUPPORT:CARMAZIUM:' || sr.customer_id,
  "supportAssignedAdminId" = COALESCE(cr."supportAssignedAdminId", sr.admin_id)
FROM support_rows sr
WHERE cr.id = sr.id
  AND sr.customer_id IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.chat_rooms
    ADD CONSTRAINT "chat_rooms_supportAssignedAdminId_fkey"
    FOREIGN KEY ("supportAssignedAdminId")
    REFERENCES public.users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "chat_rooms_supportAssignedAdminId_idx"
  ON public.chat_rooms ("supportAssignedAdminId");

CREATE INDEX IF NOT EXISTS "chat_rooms_supportClosedAt_idx"
  ON public.chat_rooms ("supportClosedAt");

CREATE TABLE IF NOT EXISTS public.support_notes (
  id text PRIMARY KEY,
  "chatRoomId" text NOT NULL,
  "authorId" text NOT NULL,
  body text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_notes_chatRoomId_fkey"
    FOREIGN KEY ("chatRoomId") REFERENCES public.chat_rooms(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_notes_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES public.users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "support_notes_chatRoomId_createdAt_idx"
  ON public.support_notes ("chatRoomId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "support_notes_authorId_idx"
  ON public.support_notes ("authorId");

CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id text PRIMARY KEY,
  "adminId" text NOT NULL,
  audience text NOT NULL,
  role user_role,
  text text,
  "mediaUrl" text,
  "mediaKind" text,
  "mediaName" text,
  "mediaMime" text,
  "mediaSize" integer,
  requested integer NOT NULL,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  status broadcast_campaign_status NOT NULL DEFAULT 'SENDING',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" timestamp(3),
  CONSTRAINT "broadcast_campaigns_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "broadcast_campaigns_createdAt_idx"
  ON public.broadcast_campaigns ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "broadcast_campaigns_adminId_idx"
  ON public.broadcast_campaigns ("adminId");

CREATE TABLE IF NOT EXISTS public.broadcast_deliveries (
  id text PRIMARY KEY,
  "campaignId" text NOT NULL,
  "userId" text NOT NULL,
  "roomId" text,
  "messageId" text,
  status broadcast_delivery_status NOT NULL DEFAULT 'PENDING',
  error text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_deliveries_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES public.broadcast_campaigns(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "broadcast_deliveries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public.users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_deliveries_campaignId_userId_key"
  ON public.broadcast_deliveries ("campaignId", "userId");

CREATE INDEX IF NOT EXISTS "broadcast_deliveries_campaignId_status_idx"
  ON public.broadcast_deliveries ("campaignId", status);

CREATE INDEX IF NOT EXISTS "broadcast_deliveries_userId_idx"
  ON public.broadcast_deliveries ("userId");

ALTER TABLE public.support_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;
