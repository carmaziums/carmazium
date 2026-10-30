# Legacy Supabase auction-cron retirement plan (prepare only)

**Prepared:** 2026-10-30 UTC. **Status:** PROPOSAL ONLY. No cron job has been changed by this document or PR.

## Evidence (read-only production audit)

- Supabase project: `bwtnzmevjlowwronylxm`.
- The four active cron jobs are #1 (`activate-pending-auctions-daily`, 07:00 UTC), #4 (`activate-pending-auctions-every-minute`), #7 (`activate-pending-auctions-every-5-min`), #8 (`check-expired-auctions-every-minute`).
- For the preceding 24-hour function-edge log window on 2026-10-30, `activate-pending-auctions` returned HTTP 500 on **1,716** calls and `check-expired-auctions` returned HTTP 500 on **1,426** calls; no other response status was observed for either endpoint in that sample.
- `net._http_response` showed **66 HTTP 500** responses in a recent 30-minute window, matching the **30+6+30** executed schedules of jobs #4, #7 and #8. `cron.job_run_details.status=succeeded` means the asynchronous HTTP request was submitted, **not** that the HTTP call returned 2xx.
- The activation endpoint error is `Could not find the 'ends_at' column of 'auctions' in the schema cache`; the current `public.auctions` table uses `startTime` and `endTime` instead.
- The expiry endpoint error is `Could not find the function public.end_expired_auctions without parameters in the schema cache`; no matching public routine exists.
- Fly.io has an independently registered NestJS `AuctionLifecycleService` running each minute; the read-only Fly diagnostic after PR #686 recorded one activation and zero lifecycle errors in its bounded log buffer.
- The live database spot check found zero overdue eligible scheduled auctions and zero overdue active auctions; this does not prove all future closure paths.

## Scope and risk

**Proposal:** unschedule only the four broken Supabase cron jobs after explicit owner approval. **Do not** delete deployed Edge Functions, functions, tables or credentials, and do not change the working Fly.io scheduler. Disable/recovery operations must be performed separately from this document.

**Risk:** The Edge Functions may have side effects not visible in the available source. Their HTTP 500 results indicate failed requests, but do not prove that no partial side effects occur. The Fly scheduler's closure branch is not yet independently observed executing successfully in this diagnostic. Validate operational ownership before removing fallback schedules.

## Before any production change

1. Obtain explicit approval specifically for unscheduling jobs **1, 4, 7 and 8**; a general 'proceed' is not sufficient.
2. Re-check that these job IDs still map to the names/targets above; abort if they differ.
3. Preserve complete current `cron.job` commands, schedules and parameters in an **admin-only, secret-safe location** for rollback. Cron commands can include authorization headers; never commit or print their raw contents to CI logs.
4. Confirm that the Fly backend is healthy and its `AuctionLifecycleService` is still registered and running; capture baseline auction counts and timestamp.
5. Choose a monitoring period and rollback owner. There is no automatic rollback in this proposal.

## Proposed manual execution (NOT automated; approval required)

After the safeguards above and a final approval, an operator can run these SQL statements in the project SQL editor (never as an automatic migration):

```sql
SELECT cron.unschedule(1) AS removed_job_1;
SELECT cron.unschedule(4) AS removed_job_4;
SELECT cron.unschedule(7) AS removed_job_7;
SELECT cron.unschedule(8) AS removed_job_8;
```

Confirm all four return `true`. Do not execute the block as part of this PR.

## Read-only checks after approved execution

```sql
SELECT jobid, jobname, active
FROM cron.job
WHERE jobid IN (1, 4, 7, 8)
ORDER BY jobid;

SELECT
  count(*) FILTER (
    WHERE status = 'SCHEDULED'
      AND "deletedAt" IS NULL
      AND "startTime" < now() - interval '5 minutes'
  ) AS overdue_scheduled,
  count(*) FILTER (
    WHERE status = 'ACTIVE'
      AND "deletedAt" IS NULL
      AND "endTime" < now() - interval '5 minutes'
  ) AS overdue_active
FROM public.auctions;
```

The first query should return no rows; also confirm the latest live/deployment state and investigate any overdue auctions, applying the parent-listing approval rule before interpreting them as errors. Keep monitoring Fly lifecycle logs, API health, and actual auction activation/expiry events. If activation or closing breaks, use the **securely preserved cron definitions** to restore schedules only after investigating whether the Edge Functions have been repaired. Do not assume simply re-scheduling HTTP-500 endpoints restores auction functionality.

## Deployment boundary

This PR is documentation and an operator runbook only. Merging it must not change production, schedule anything, deploy Edge Functions, or deploy Fly.io.