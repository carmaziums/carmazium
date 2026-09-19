-- TradeXchange remediation — Block 9: admin, disputes, reviews and operational controls.
--
-- Adds an authoritative financial settlement audit trail, immutable provider
-- capability status history, verified released-job reviews, and payment audit
-- events. These tables are backend-only and are not exposed to anon/authenticated
-- Data API roles.

create table if not exists public.service_settlement_operations (
    id text primary key default gen_random_uuid()::text,
    "jobId" text not null references public.service_jobs(id) on delete restrict,
    "paymentId" text not null references public.service_payments(id) on delete restrict,
    "adminId" text not null references public.users(id) on delete restrict,
    outcome text not null check (outcome in ('RELEASE', 'REFUND')),
    status text not null default 'STARTED'
        check (status in ('STARTED', 'SUCCEEDED', 'FAILED', 'REQUIRES_RECONCILIATION')),
    note text,
    "externalReference" text,
    error text,
    "attemptCount" integer not null default 1 check ("attemptCount" > 0),
    "completedAt" timestamptz,
    "createdAt" timestamptz not null default now(),
    "updatedAt" timestamptz not null default now(),
    unique ("jobId", "paymentId", outcome)
);

create index if not exists service_settlement_operations_job_created_idx
    on public.service_settlement_operations ("jobId", "createdAt" desc);
create index if not exists service_settlement_operations_status_updated_idx
    on public.service_settlement_operations (status, "updatedAt" desc);

alter table public.service_settlement_operations enable row level security;
revoke all on table public.service_settlement_operations from anon, authenticated;

create table if not exists public.service_capability_status_history (
    id text primary key default gen_random_uuid()::text,
    "capabilityId" text not null references public.contractor_capabilities(id) on delete cascade,
    "fromStatus" capability_status,
    "toStatus" capability_status not null,
    "adminId" text references public.users(id) on delete set null,
    note text,
    "createdAt" timestamptz not null default now()
);

create index if not exists service_capability_status_history_capability_created_idx
    on public.service_capability_status_history ("capabilityId", "createdAt" desc);

alter table public.service_capability_status_history enable row level security;
revoke all on table public.service_capability_status_history from anon, authenticated;

insert into public.service_capability_status_history
    ("capabilityId", "fromStatus", "toStatus", "adminId", note, "createdAt")
select
    c.id,
    null,
    c.status,
    c."reviewedById",
    c."reviewNote",
    coalesce(c."reviewedAt", c."appliedAt", c."createdAt")
from public.contractor_capabilities c
where not exists (
    select 1
    from public.service_capability_status_history h
    where h."capabilityId" = c.id
);

create or replace function public.tradexchange_record_capability_status_history()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.service_capability_status_history
            ("capabilityId", "fromStatus", "toStatus", "adminId", note, "createdAt")
        values (
            new.id,
            null,
            new.status,
            case when new."reviewedAt" is not null then new."reviewedById" else null end,
            new."reviewNote",
            coalesce(new."reviewedAt", new."appliedAt", new."createdAt", now())
        );
    elsif new.status is distinct from old.status then
        insert into public.service_capability_status_history
            ("capabilityId", "fromStatus", "toStatus", "adminId", note, "createdAt")
        values (
            new.id,
            old.status,
            new.status,
            case when new."reviewedAt" is distinct from old."reviewedAt" then new."reviewedById" else null end,
            new."reviewNote",
            now()
        );
    end if;
    return new;
end;
$$;

drop trigger if exists contractor_capabilities_status_history on public.contractor_capabilities;
create trigger contractor_capabilities_status_history
after insert or update of status on public.contractor_capabilities
for each row execute function public.tradexchange_record_capability_status_history();

create table if not exists public.service_reviews (
    id text primary key default gen_random_uuid()::text,
    "jobId" text not null unique references public.service_jobs(id) on delete restrict,
    "customerId" text not null references public.users(id) on delete restrict,
    "contractorId" text not null references public.contractor_profiles(id) on delete restrict,
    rating smallint not null check (rating between 1 and 5),
    comment text,
    "createdAt" timestamptz not null default now(),
    "updatedAt" timestamptz not null default now()
);

create index if not exists service_reviews_contractor_created_idx
    on public.service_reviews ("contractorId", "createdAt" desc);
create index if not exists service_reviews_customer_created_idx
    on public.service_reviews ("customerId", "createdAt" desc);

alter table public.service_reviews enable row level security;
revoke all on table public.service_reviews from anon, authenticated;

create or replace function public.tradexchange_validate_service_review()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
    j record;
    payment_status service_payment_status;
begin
    select "customerId", "contractorId", status
      into j
      from public.service_jobs
     where id = new."jobId";

    if not found then
        raise exception 'Service job not found for review';
    end if;
    if j.status <> 'RELEASED'::service_job_status then
        raise exception 'Only released service jobs can be reviewed';
    end if;
    if j."customerId" <> new."customerId" then
        raise exception 'Review customer does not match service job';
    end if;
    if j."contractorId" is null or j."contractorId" <> new."contractorId" then
        raise exception 'Review provider does not match service job';
    end if;

    select status into payment_status
      from public.service_payments
     where "jobId" = new."jobId";

    if payment_status is distinct from 'RELEASED'::service_payment_status then
        raise exception 'Only financially released service jobs can be reviewed';
    end if;

    return new;
end;
$$;

drop trigger if exists service_reviews_validate on public.service_reviews;
create trigger service_reviews_validate
before insert or update on public.service_reviews
for each row execute function public.tradexchange_validate_service_review();

create or replace function public.tradexchange_refresh_contractor_rating()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
    target_contractor text;
begin
    if tg_op = 'DELETE' then
        target_contractor := old."contractorId";
    else
        target_contractor := new."contractorId";
    end if;

    update public.contractor_profiles cp
       set rating = coalesce((
               select round(avg(r.rating)::numeric, 2)::double precision
               from public.service_reviews r
               where r."contractorId" = target_contractor
           ), 0),
           "totalReviews" = (
               select count(*)::integer
               from public.service_reviews r
               where r."contractorId" = target_contractor
           ),
           "updatedAt" = now()
     where cp.id = target_contractor;

    if tg_op = 'UPDATE' and old."contractorId" is distinct from new."contractorId" then
        update public.contractor_profiles cp
           set rating = coalesce((
                   select round(avg(r.rating)::numeric, 2)::double precision
                   from public.service_reviews r
                   where r."contractorId" = old."contractorId"
               ), 0),
               "totalReviews" = (
                   select count(*)::integer
                   from public.service_reviews r
                   where r."contractorId" = old."contractorId"
               ),
               "updatedAt" = now()
         where cp.id = old."contractorId";
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists service_reviews_refresh_rating on public.service_reviews;
create trigger service_reviews_refresh_rating
after insert or update or delete on public.service_reviews
for each row execute function public.tradexchange_refresh_contractor_rating();

-- From Block 9 onward, the displayed contractor rating is derived only from
-- verified TradeXchange service_reviews. This also removes any legacy/manual
-- counters that do not have a released-job review behind them.
update public.contractor_profiles cp
set rating = coalesce((
        select round(avg(r.rating)::numeric, 2)::double precision
        from public.service_reviews r
        where r."contractorId" = cp.id
    ), 0),
    "totalReviews" = (
        select count(*)::integer
        from public.service_reviews r
        where r."contractorId" = cp.id
    ),
    "updatedAt" = now();

create table if not exists public.service_payment_audit_events (
    id text primary key default gen_random_uuid()::text,
    "paymentId" text not null references public.service_payments(id) on delete restrict,
    "jobId" text not null references public.service_jobs(id) on delete restrict,
    "fromStatus" service_payment_status,
    "toStatus" service_payment_status not null,
    "stripeTransferId" text,
    "stripePaymentIntentId" text,
    "createdAt" timestamptz not null default now()
);

create index if not exists service_payment_audit_events_job_created_idx
    on public.service_payment_audit_events ("jobId", "createdAt" desc);
create index if not exists service_payment_audit_events_payment_created_idx
    on public.service_payment_audit_events ("paymentId", "createdAt" desc);

alter table public.service_payment_audit_events enable row level security;
revoke all on table public.service_payment_audit_events from anon, authenticated;

insert into public.service_payment_audit_events
    ("paymentId", "jobId", "fromStatus", "toStatus", "stripeTransferId", "stripePaymentIntentId", "createdAt")
select
    p.id,
    p."jobId",
    null,
    p.status,
    p."stripeTransferId",
    p."stripePaymentIntentId",
    coalesce(p."releasedAt", p."refundedAt", p."paidAt", p."createdAt")
from public.service_payments p
where p.status in ('RELEASED'::service_payment_status, 'REFUNDED'::service_payment_status)
  and not exists (
      select 1 from public.service_payment_audit_events a
      where a."paymentId" = p.id and a."toStatus" = p.status
  );

create or replace function public.tradexchange_record_payment_audit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    if new.status is distinct from old.status then
        insert into public.service_payment_audit_events
            ("paymentId", "jobId", "fromStatus", "toStatus", "stripeTransferId", "stripePaymentIntentId", "createdAt")
        values (
            new.id,
            new."jobId",
            old.status,
            new.status,
            new."stripeTransferId",
            new."stripePaymentIntentId",
            now()
        );
    end if;
    return new;
end;
$$;

drop trigger if exists service_payments_audit_status on public.service_payments;
create trigger service_payments_audit_status
after update of status on public.service_payments
for each row execute function public.tradexchange_record_payment_audit();
