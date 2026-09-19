-- TradeXchange remediation — Block 3: purchase-to-delivery integrity.
--
-- A purchase-linked delivery job has exactly one source (retail offer OR auction),
-- always represents DELIVERY, and only one non-cancelled/non-expired workflow may
-- exist for that purchase at a time. CANCELLED/EXPIRED jobs may be intentionally
-- reposted later.

alter table public.service_jobs
    drop constraint if exists service_jobs_purchase_source_exclusive;

alter table public.service_jobs
    add constraint service_jobs_purchase_source_exclusive
    check (
        not ("sourceOfferId" is not null and "sourceAuctionId" is not null)
    ) not valid;

alter table public.service_jobs
    validate constraint service_jobs_purchase_source_exclusive;

alter table public.service_jobs
    drop constraint if exists service_jobs_purchase_source_delivery_only;

alter table public.service_jobs
    add constraint service_jobs_purchase_source_delivery_only
    check (
        ("sourceOfferId" is null and "sourceAuctionId" is null)
        or "serviceType"::text = 'DELIVERY'
    ) not valid;

alter table public.service_jobs
    validate constraint service_jobs_purchase_source_delivery_only;

create unique index if not exists service_jobs_active_source_offer_uidx
    on public.service_jobs ("sourceOfferId")
    where "sourceOfferId" is not null
      and "status" not in ('CANCELLED', 'EXPIRED');

create unique index if not exists service_jobs_active_source_auction_uidx
    on public.service_jobs ("sourceAuctionId")
    where "sourceAuctionId" is not null
      and "status" not in ('CANCELLED', 'EXPIRED');
