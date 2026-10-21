-- One reminder per auction run, seller and stage across multiple application workers.
-- Stage key includes provisionalOfferedAt, so a later auction run can remind again.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_provisional_reminder_dedup"
ON "notifications" ("entityId", "userId", "actionType")
WHERE "actionType" LIKE 'PROVISIONAL_REMINDER_%';
