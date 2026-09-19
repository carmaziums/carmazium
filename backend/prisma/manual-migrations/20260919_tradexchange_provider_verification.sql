-- TradeXchange remediation — Block 6: provider approval and verification.
--
-- Defines what "CarMazium approved provider" means for each service:
-- service-specific evidence, evidence review status/expiry, annual
-- re-verification, approval gates and reminder state.
--
-- Production audit before this migration:
--   * 7 capability rows total
--   * 2 APPROVED (1 Delivery, 1 Inspection)
--   * 0 capability verification documents
--   * approved provider has 0 quotes, 0 active assigned jobs and 0 unsettled payments
-- Therefore the two legacy approvals can safely return to PENDING
-- re-verification without interrupting live work.

alter table public.contractor_capabilities
    add column if not exists "verificationStatus" text not null default 'NOT_SUBMITTED',
    add column if not exists "verificationCompletedAt" timestamp(3),
    add column if not exists "verificationExpiresAt" timestamp(3),
    add column if not exists "verificationReminder30SentAt" timestamp(3),
    add column if not exists "verificationReminder7SentAt" timestamp(3);

alter table public.contractor_capabilities
    drop constraint if exists contractor_capabilities_verification_status_check;

alter table public.contractor_capabilities
    add constraint contractor_capabilities_verification_status_check
    check (
        "verificationStatus" in (
            'NOT_SUBMITTED',
            'IN_REVIEW',
            'READY',
            'VERIFIED',
            'REVERIFICATION_REQUIRED',
            'REJECTED'
        )
    ) not valid;

alter table public.contractor_capabilities
    validate constraint contractor_capabilities_verification_status_check;

create index if not exists contractor_capabilities_verification_expiry_idx
    on public.contractor_capabilities ("verificationStatus", "verificationExpiresAt")
    where "verificationExpiresAt" is not null;

alter table public.service_case_entries
    add column if not exists "evidenceType" text,
    add column if not exists "evidenceStatus" text,
    add column if not exists "evidenceIssuer" text,
    add column if not exists "evidenceReference" text,
    add column if not exists "evidenceValidFrom" timestamp(3),
    add column if not exists "evidenceExpiresAt" timestamp(3),
    add column if not exists "evidenceReviewedAt" timestamp(3),
    add column if not exists "evidenceReviewedById" text,
    add column if not exists "evidenceReviewNote" text;

alter table public.service_case_entries
    drop constraint if exists service_case_entries_evidence_type_check,
    drop constraint if exists service_case_entries_evidence_status_check,
    drop constraint if exists service_case_entries_evidence_dates_check,
    drop constraint if exists service_case_entries_capability_evidence_classified;

alter table public.service_case_entries
    add constraint service_case_entries_evidence_type_check
    check (
        "evidenceType" is null
        or "evidenceType" in (
            'BUSINESS_IDENTITY',
            'DELIVERY_BUSINESS_INSURANCE',
            'DELIVERY_GOODS_IN_TRANSIT',
            'INSPECTION_BUSINESS_INSURANCE',
            'INSPECTION_QUALIFICATION',
            'FINANCE_REGULATORY_AUTHORITY',
            'WARRANTY_REGULATORY_AUTHORITY',
            'WARRANTY_PRODUCT_AUTHORITY'
        )
    ) not valid,
    add constraint service_case_entries_evidence_status_check
    check (
        "evidenceStatus" is null
        or "evidenceStatus" in ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED')
    ) not valid,
    add constraint service_case_entries_evidence_dates_check
    check (
        "evidenceValidFrom" is null
        or "evidenceExpiresAt" is null
        or "evidenceValidFrom" <= "evidenceExpiresAt"
    ) not valid;

alter table public.service_case_entries
    validate constraint service_case_entries_evidence_type_check;
alter table public.service_case_entries
    validate constraint service_case_entries_evidence_status_check;
alter table public.service_case_entries
    validate constraint service_case_entries_evidence_dates_check;
alter table public.service_case_entries
    add constraint service_case_entries_capability_evidence_classified
    check (
        "scope" <> 'CAPABILITY'
        or "kind" not in ('DOCUMENT', 'PHOTO')
        or ("evidenceType" is not null and "evidenceStatus" is not null)
    ) not valid;

alter table public.service_case_entries
    validate constraint service_case_entries_capability_evidence_classified;


do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'service_case_entries_evidenceReviewedById_fkey'
          and conrelid = 'public.service_case_entries'::regclass
    ) then
        alter table public.service_case_entries
            add constraint "service_case_entries_evidenceReviewedById_fkey"
            foreign key ("evidenceReviewedById")
            references public.users("id")
            on delete set null;
    end if;
end $$;

create index if not exists service_case_entries_capability_evidence_idx
    on public.service_case_entries (
        "entityId",
        "evidenceType",
        "evidenceStatus",
        "createdAt" desc
    )
    where "scope" = 'CAPABILITY';

create index if not exists service_case_entries_evidence_reviewer_idx
    on public.service_case_entries ("evidenceReviewedById")
    where "evidenceReviewedById" is not null;

create index if not exists service_case_entries_evidence_expiry_idx
    on public.service_case_entries ("evidenceExpiresAt")
    where "scope" = 'CAPABILITY'
      and "evidenceStatus" = 'APPROVED'
      and "evidenceExpiresAt" is not null;

-- Existing approvals predate evidence-gated verification and production has no
-- capability evidence rows. Return them to the review queue rather than
-- grandfathering an unauditable "approved" badge.
update public.contractor_capabilities cc
set
    status = 'PENDING',
    "appliedAt" = current_timestamp,
    "verificationStatus" = 'REVERIFICATION_REQUIRED',
    "verificationCompletedAt" = null,
    "verificationExpiresAt" = null,
    "verificationReminder30SentAt" = null,
    "verificationReminder7SentAt" = null,
    "reviewNote" = coalesce(
        cc."reviewNote",
        'Re-verification required under the current CarMazium provider verification standard.'
    )
where cc.status::text = 'APPROVED'
  and not exists (
      select 1
      from public.service_case_entries e
      where e."scope" = 'CAPABILITY'
        and e."entityId" = cc.id
        and e."evidenceStatus" = 'APPROVED'
  );
