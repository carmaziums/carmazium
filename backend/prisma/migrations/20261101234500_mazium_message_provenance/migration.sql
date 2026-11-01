-- Record auditable AI authorship without conflating it with human staff.
-- One inbound message may cause at most one stored AI reply, across retries.
ALTER TABLE "messages" ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN "aiSourceMessageId" TEXT;
CREATE UNIQUE INDEX "messages_aiSourceMessageId_key" ON "messages"("aiSourceMessageId");
