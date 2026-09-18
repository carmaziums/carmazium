DO $$
BEGIN
  CREATE TYPE public.dispute_status AS ENUM ('OPEN','RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.dispute_cases (
  id text PRIMARY KEY,
  "sourceRoomId" text NOT NULL,
  "chatRoomId" text NOT NULL,
  "listingId" text NOT NULL,
  "buyerId" text NOT NULL,
  "sellerId" text NOT NULL,
  "openedById" text NOT NULL,
  "joinedAdminId" text,
  "resolvedById" text,
  status public.dispute_status NOT NULL DEFAULT 'OPEN',
  reason text,
  "adminJoinedAt" timestamp(3),
  "resolvedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_cases_sourceRoomId_fkey"
    FOREIGN KEY ("sourceRoomId") REFERENCES public.chat_rooms(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "dispute_cases_chatRoomId_fkey"
    FOREIGN KEY ("chatRoomId") REFERENCES public.chat_rooms(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dispute_cases_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES public.listings(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "dispute_cases_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "dispute_cases_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "dispute_cases_openedById_fkey"
    FOREIGN KEY ("openedById") REFERENCES public.users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "dispute_cases_joinedAdminId_fkey"
    FOREIGN KEY ("joinedAdminId") REFERENCES public.users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "dispute_cases_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES public.users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "dispute_cases_sourceRoomId_key"
  ON public.dispute_cases ("sourceRoomId");

CREATE UNIQUE INDEX IF NOT EXISTS "dispute_cases_chatRoomId_key"
  ON public.dispute_cases ("chatRoomId");

CREATE INDEX IF NOT EXISTS "dispute_cases_status_createdAt_idx"
  ON public.dispute_cases (status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "dispute_cases_joinedAdminId_status_idx"
  ON public.dispute_cases ("joinedAdminId", status);

CREATE INDEX IF NOT EXISTS "dispute_cases_listingId_idx"
  ON public.dispute_cases ("listingId");

CREATE INDEX IF NOT EXISTS "dispute_cases_buyerId_idx"
  ON public.dispute_cases ("buyerId");

CREATE INDEX IF NOT EXISTS "dispute_cases_sellerId_idx"
  ON public.dispute_cases ("sellerId");

CREATE TABLE IF NOT EXISTS public.dispute_read_states (
  id text PRIMARY KEY,
  "disputeId" text NOT NULL,
  "userId" text NOT NULL,
  "lastReadAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_read_states_disputeId_fkey"
    FOREIGN KEY ("disputeId") REFERENCES public.dispute_cases(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dispute_read_states_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public.users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "dispute_read_states_disputeId_userId_key"
  ON public.dispute_read_states ("disputeId", "userId");

CREATE INDEX IF NOT EXISTS "dispute_read_states_userId_lastReadAt_idx"
  ON public.dispute_read_states ("userId", "lastReadAt");

ALTER TABLE public.dispute_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_read_states ENABLE ROW LEVEL SECURITY;
