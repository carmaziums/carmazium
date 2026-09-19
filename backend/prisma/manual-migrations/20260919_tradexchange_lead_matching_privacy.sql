-- TradeXchange remediation — Block 5: Finance/Warranty matching and privacy.
--
-- Add explicit machine-readable matching criteria, auditable recipient metadata,
-- and a retention/anonymisation lifecycle for closed or expired enquiries.

alter table public.contractor_capabilities
    add column if not exists "leadNationwide" boolean not null default false,
    add column if not exists "leadPostcodeAreas" text[] not null default '{}'::text[],
    add column if not exists "leadMinVehicleValuePence" integer,
    add column if not exists "leadMaxVehicleValuePence" integer,
    add column if not exists "leadMinVehicleYear" integer,
    add column if not exists "leadMaxVehicleMileage" integer,
    add column if not exists "leadMinAnnualIncomePence" integer,
    add column if not exists "leadFinanceTermMinMonths" integer,
    add column if not exists "leadFinanceTermMaxMonths" integer,
    add column if not exists "leadWarrantyLevels" text[] not null default '{}'::text[],
    add column if not exists "leadWarrantyMinMonths" integer,
    add column if not exists "leadWarrantyMaxMonths" integer;

alter table public.contractor_capabilities
    drop constraint if exists contractor_capabilities_lead_matching_ranges;

alter table public.contractor_capabilities
    add constraint contractor_capabilities_lead_matching_ranges
    check (
        ("leadMinVehicleValuePence" is null or "leadMinVehicleValuePence" >= 0)
        and ("leadMaxVehicleValuePence" is null or "leadMaxVehicleValuePence" >= 0)
        and (
            "leadMinVehicleValuePence" is null
            or "leadMaxVehicleValuePence" is null
            or "leadMinVehicleValuePence" <= "leadMaxVehicleValuePence"
        )
        and ("leadMinVehicleYear" is null or "leadMinVehicleYear" between 1900 and 2100)
        and ("leadMaxVehicleMileage" is null or "leadMaxVehicleMileage" >= 0)
        and ("leadMinAnnualIncomePence" is null or "leadMinAnnualIncomePence" >= 0)
        and ("leadFinanceTermMinMonths" is null or "leadFinanceTermMinMonths" between 1 and 120)
        and ("leadFinanceTermMaxMonths" is null or "leadFinanceTermMaxMonths" between 1 and 120)
        and (
            "leadFinanceTermMinMonths" is null
            or "leadFinanceTermMaxMonths" is null
            or "leadFinanceTermMinMonths" <= "leadFinanceTermMaxMonths"
        )
        and ("leadWarrantyMinMonths" is null or "leadWarrantyMinMonths" between 1 and 84)
        and ("leadWarrantyMaxMonths" is null or "leadWarrantyMaxMonths" between 1 and 84)
        and (
            "leadWarrantyMinMonths" is null
            or "leadWarrantyMaxMonths" is null
            or "leadWarrantyMinMonths" <= "leadWarrantyMaxMonths"
        )
    ) not valid;

alter table public.contractor_capabilities
    validate constraint contractor_capabilities_lead_matching_ranges;

alter table public.service_leads
    alter column "customerId" drop not null,
    alter column "fullName" drop not null,
    alter column "email" drop not null,
    add column if not exists "closedAt" timestamp(3),
    add column if not exists "anonymizedAt" timestamp(3);

update public.service_leads
set "closedAt" = coalesce("closedAt", "updatedAt")
where status in ('CLOSED', 'EXPIRED')
  and "closedAt" is null;

create index if not exists service_leads_retention_idx
    on public.service_leads (status, "closedAt");

alter table public.service_lead_recipients
    add column if not exists "matchedAt" timestamp(3) not null default current_timestamp,
    add column if not exists "matchSource" text not null default 'AUTO',
    add column if not exists "matchReason" text,
    add column if not exists "contactDisclosedAt" timestamp(3);

update public.service_lead_recipients
set "matchedAt" = "createdAt"
where "matchedAt" is null;

alter table public.service_lead_recipients
    drop constraint if exists service_lead_recipients_match_source_check;

alter table public.service_lead_recipients
    add constraint service_lead_recipients_match_source_check
    check ("matchSource" in ('AUTO', 'ADMIN_REMATCH')) not valid;

alter table public.service_lead_recipients
    validate constraint service_lead_recipients_match_source_check;
