-- TradeXchange remediation — Block 7: dealership staff permissions and business identity.
--
-- Bind active permissions to the actual staff user (email remains useful for
-- pending invitations), add explicit view/chat rights, preserve existing staff
-- access, and align dealership-owned ContractorProfile identity with the
-- canonical DealerProfile business identity.

alter table public.trade_service_team_permissions
    add column if not exists "staffUserId" text,
    add column if not exists "canView" boolean not null default false,
    add column if not exists "canChat" boolean not null default false;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'trade_service_team_permissions_staffUserId_fkey'
          and conrelid = 'public.trade_service_team_permissions'::regclass
    ) then
        alter table public.trade_service_team_permissions
            add constraint "trade_service_team_permissions_staffUserId_fkey"
            foreign key ("staffUserId") references public.users(id) on delete set null;
    end if;
end $$;

-- Historical team permissions implicitly allowed job viewing and paid-job chat.
-- Preserve that behaviour during the migration; future grants are explicit.
update public.trade_service_team_permissions
set
    "canView" = true,
    "canChat" = true
where "deliveryEnabled" = true or "inspectionEnabled" = true;

-- Bind current active staff rows to immutable user IDs. Pending invitations
-- intentionally remain email-only until the invite is accepted and first used.
update public.trade_service_team_permissions p
set
    "staffUserId" = ds."userId",
    "email" = lower(u.email),
    "updatedAt" = current_timestamp
from public.dealer_staff ds
join public.users u on u.id = ds."userId"
where ds."dealerProfileId" = p."dealerProfileId"
  and ds."isActive" = true
  and lower(u.email) = p."email"
  and p."staffUserId" is null;

create unique index if not exists trade_service_team_permissions_staff_uidx
    on public.trade_service_team_permissions ("dealerProfileId", "staffUserId")
    where "staffUserId" is not null;

create index if not exists trade_service_team_permissions_staff_idx
    on public.trade_service_team_permissions ("staffUserId")
    where "staffUserId" is not null;

alter table public.trade_service_team_permissions
    drop constraint if exists trade_service_team_permissions_action_requires_service,
    drop constraint if exists trade_service_team_permissions_operational_requires_view;

alter table public.trade_service_team_permissions
    add constraint trade_service_team_permissions_action_requires_service
    check (
        not ("canView" or "canChat" or "canQuote" or "canManage" or "canComplete")
        or "deliveryEnabled"
        or "inspectionEnabled"
    ) not valid,
    add constraint trade_service_team_permissions_operational_requires_view
    check (
        not ("canChat" or "canQuote" or "canManage" or "canComplete")
        or "canView"
    ) not valid;

alter table public.trade_service_team_permissions
    validate constraint trade_service_team_permissions_action_requires_service;
alter table public.trade_service_team_permissions
    validate constraint trade_service_team_permissions_operational_requires_view;

-- DealerProfile is the canonical identity for a dealership-owned Partner
-- Account. ContractorProfile is the service-market projection of that same
-- business and must not drift to a different public name/contact/address.
update public.contractor_profiles cp
set
    "businessName" = nullif(trim(dp."companyName"), ''),
    "phone" = nullif(trim(coalesce(dp."phone", '')), ''),
    "serviceArea" = nullif(trim(coalesce(dp."businessAddress", '')), ''),
    "updatedAt" = current_timestamp
from public.dealer_profiles dp
where dp."userId" = cp."userId"
  and (
      cp."businessName" is distinct from nullif(trim(dp."companyName"), '')
      or cp."phone" is distinct from nullif(trim(coalesce(dp."phone", '')), '')
      or cp."serviceArea" is distinct from nullif(trim(coalesce(dp."businessAddress", '')), '')
  );
