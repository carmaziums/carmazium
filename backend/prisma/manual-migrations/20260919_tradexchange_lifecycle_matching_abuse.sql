-- TradeXchange remediation — Block 8: lead/job lifecycle, matching and abuse controls.

alter table public.contractor_capabilities
    add column if not exists "jobNationwide" boolean not null default false,
    add column if not exists "jobPostcodeAreas" text[] not null default '{}';

alter table public.service_jobs
    add column if not exists "workPostcodeArea" text;

-- Preserve the pre-Block-8 semantics for any provider that was already
-- approved before geographic matching existed. New approvals start with no
-- coverage until the business deliberately configures it.
update public.contractor_capabilities
set "jobNationwide" = true
where "serviceType" in ('DELIVERY'::service_type, 'INSPECTION'::service_type)
  and status = 'APPROVED'::capability_status
  and "jobNationwide" = false
  and cardinality("jobPostcodeAreas") = 0;

-- Backfill the stable area used for matching. Delivery is routed from pickup;
-- inspection is routed from the vehicle/service location.
update public.service_jobs
set "workPostcodeArea" = case
    when "serviceType" = 'DELIVERY'::service_type
        then substring(upper(regexp_replace(coalesce("pickupPostcode", ''), '\s+', '', 'g')) from '^(GIR|[A-Z]{1,2})')
    when "serviceType" = 'INSPECTION'::service_type
        then substring(upper(regexp_replace(coalesce("servicePostcode", ''), '\s+', '', 'g')) from '^(GIR|[A-Z]{1,2})')
    else null
end
where "workPostcodeArea" is null;

alter table public.service_jobs
    drop constraint if exists service_jobs_work_postcode_area_format,
    drop constraint if exists service_jobs_uk_postcode_format;

alter table public.service_jobs
    add constraint service_jobs_work_postcode_area_format
    check (
        "workPostcodeArea" is null
        or "workPostcodeArea" ~ '^(GIR|[A-Z]{1,2})$'
    ) not valid,
    add constraint service_jobs_uk_postcode_format
    check (
        ("pickupPostcode" is null or upper(regexp_replace("pickupPostcode", '\s+', '', 'g')) ~ '^(GIR0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)[0-9][ABD-HJLNP-UW-Z]{2})$')
        and
        ("deliveryPostcode" is null or upper(regexp_replace("deliveryPostcode", '\s+', '', 'g')) ~ '^(GIR0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)[0-9][ABD-HJLNP-UW-Z]{2})$')
        and
        ("servicePostcode" is null or upper(regexp_replace("servicePostcode", '\s+', '', 'g')) ~ '^(GIR0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)[0-9][ABD-HJLNP-UW-Z]{2})$')
    ) not valid;

alter table public.service_jobs
    validate constraint service_jobs_work_postcode_area_format;
alter table public.service_jobs
    validate constraint service_jobs_uk_postcode_format;

alter table public.service_leads
    drop constraint if exists service_leads_uk_postcode_format;

alter table public.service_leads
    add constraint service_leads_uk_postcode_format
    check (
        "postcode" is null
        or upper(regexp_replace("postcode", '\s+', '', 'g')) ~ '^(GIR0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)[0-9][ABD-HJLNP-UW-Z]{2})$'
    ) not valid;

alter table public.service_leads
    validate constraint service_leads_uk_postcode_format;

create index if not exists service_jobs_type_status_area_created_id_idx
    on public.service_jobs ("serviceType", status, "workPostcodeArea", "createdAt" desc, id desc);

create index if not exists service_jobs_customer_created_id_idx
    on public.service_jobs ("customerId", "createdAt" desc, id desc);

create index if not exists service_jobs_contractor_updated_id_idx
    on public.service_jobs ("contractorId", "updatedAt" desc, id desc)
    where "contractorId" is not null;

create index if not exists service_leads_customer_created_id_idx
    on public.service_leads ("customerId", "createdAt" desc, id desc)
    where "customerId" is not null;

create index if not exists service_lead_recipients_contractor_lead_idx
    on public.service_lead_recipients ("contractorId", "leadId", id);
