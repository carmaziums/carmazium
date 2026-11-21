-- The signed Master Business Partner Agreement requires current Public Liability
-- evidence for delivery/recovery and inspections. Previously verified service
-- capabilities may not have it, because the old checklist did not request it.
--
-- Existing accepted paid jobs remain readable and completable; only NEW work
-- requires current verification again. Admin approval status is retained for
-- audit. Migration is idempotent.
UPDATE "contractor_capabilities" AS capability
SET
    "verificationStatus" = 'REVERIFICATION_REQUIRED',
    "verificationCompletedAt" = NULL,
    "verificationExpiresAt" = NULL,
    "verificationReminder30SentAt" = NULL,
    "verificationReminder7SentAt" = NULL,
    "updatedAt" = NOW()
WHERE capability."serviceType" IN ('DELIVERY', 'INSPECTION')
  AND capability."verificationStatus" = 'VERIFIED'
  AND NOT EXISTS (
      SELECT 1
      FROM "service_case_entries" AS evidence
      WHERE evidence."scope" = 'CAPABILITY'
        AND evidence."entityId" = capability."id"
        AND evidence."kind" IN ('DOCUMENT', 'PHOTO')
        AND evidence."evidenceType" = CASE
            WHEN capability."serviceType" = 'DELIVERY' THEN 'DELIVERY_PUBLIC_LIABILITY'
            ELSE 'INSPECTION_PUBLIC_LIABILITY'
        END
        AND evidence."evidenceStatus" = 'APPROVED'
        AND evidence."evidenceExpiresAt" > NOW()
  );
