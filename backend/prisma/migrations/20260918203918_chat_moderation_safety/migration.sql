DO $$
BEGIN
  CREATE TYPE public.chat_report_reason AS ENUM (
    'HARASSMENT',
    'SCAM_FRAUD',
    'SPAM',
    'INAPPROPRIATE_CONTENT',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.chat_report_status AS ENUM (
    'OPEN',
    'REVIEWING',
    'RESOLVED',
    'DISMISSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.chat_reports (
  id text PRIMARY KEY,
  "chatRoomId" text NOT NULL,
  "messageId" text NOT NULL,
  "reporterId" text NOT NULL,
  "reportedUserId" text NOT NULL,
  reason public.chat_report_reason NOT NULL,
  details text,
  "messageContent" text NOT NULL,
  "attachmentPath" text,
  "attachmentName" text,
  "attachmentMime" text,
  "attachmentSize" integer,
  "roomContext" public.chat_context NOT NULL,
  "listingId" text,
  "listingTitle" text,
  status public.chat_report_status NOT NULL DEFAULT 'OPEN',
  "reviewedById" text,
  "reviewedAt" timestamp(3),
  "adminNote" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_reports_chatRoomId_fkey"
    FOREIGN KEY ("chatRoomId") REFERENCES public.chat_rooms(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "chat_reports_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES public.messages(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "chat_reports_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "chat_reports_reportedUserId_fkey"
    FOREIGN KEY ("reportedUserId") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "chat_reports_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES public.users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_reports_messageId_reporterId_key"
  ON public.chat_reports ("messageId", "reporterId");

CREATE INDEX IF NOT EXISTS "chat_reports_status_createdAt_idx"
  ON public.chat_reports (status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "chat_reports_chatRoomId_idx"
  ON public.chat_reports ("chatRoomId");

CREATE INDEX IF NOT EXISTS "chat_reports_reporterId_idx"
  ON public.chat_reports ("reporterId");

CREATE INDEX IF NOT EXISTS "chat_reports_reportedUserId_idx"
  ON public.chat_reports ("reportedUserId");

CREATE INDEX IF NOT EXISTS "chat_reports_reviewedById_idx"
  ON public.chat_reports ("reviewedById");

CREATE TABLE IF NOT EXISTS public.chat_blocks (
  id text PRIMARY KEY,
  "chatRoomId" text NOT NULL,
  "blockerId" text NOT NULL,
  "blockedUserId" text NOT NULL,
  reason text,
  "revokedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_blocks_chatRoomId_fkey"
    FOREIGN KEY ("chatRoomId") REFERENCES public.chat_rooms(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_blocks_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "chat_blocks_blockedUserId_fkey"
    FOREIGN KEY ("blockedUserId") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_blocks_chatRoomId_blockerId_blockedUserId_key"
  ON public.chat_blocks ("chatRoomId", "blockerId", "blockedUserId");

CREATE INDEX IF NOT EXISTS "chat_blocks_chatRoomId_revokedAt_idx"
  ON public.chat_blocks ("chatRoomId", "revokedAt");

CREATE INDEX IF NOT EXISTS "chat_blocks_blockerId_idx"
  ON public.chat_blocks ("blockerId");

CREATE INDEX IF NOT EXISTS "chat_blocks_blockedUserId_idx"
  ON public.chat_blocks ("blockedUserId");

ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_blocks ENABLE ROW LEVEL SECURITY;
