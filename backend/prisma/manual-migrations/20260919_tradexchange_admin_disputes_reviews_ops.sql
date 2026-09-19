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
