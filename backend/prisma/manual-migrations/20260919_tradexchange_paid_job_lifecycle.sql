-- TradeXchange remediation — Block 2: paid-job lifecycle hardening.
--
-- Normal paid work must progress:
--   PAID -> IN_PROGRESS -> COMPLETED
-- before customer confirmation or the 48-hour auto-release path can pay out.
--
-- DISPUTED and RELEASED are intentionally not forced into this timestamp shape:
-- an admin may resolve a dispute as an explicit, audited override even if the
-- dispute was opened before work started.

alter table public.service_jobs
    drop constraint if exists service_jobs_paid_lifecycle_consistency;

alter table public.service_jobs
    add constraint service_jobs_paid_lifecycle_consistency
    check (
        (
            "status"::text not in ('OPEN', 'ACCEPTED', 'PAID')
            or (
                "startedAt" is null
                and "completedAt" is null
                and "confirmedAt" is null
            )
        )
        and (
            "status"::text <> 'IN_PROGRESS'
            or (
                "startedAt" is not null
                and "completedAt" is null
                and "confirmedAt" is null
            )
        )
        and (
            "status"::text <> 'COMPLETED'
            or (
                "startedAt" is not null
                and "completedAt" is not null
                and "completedAt" >= "startedAt"
                and "confirmedAt" is null
            )
        )
    ) not valid;

alter table public.service_jobs
    validate constraint service_jobs_paid_lifecycle_consistency;
