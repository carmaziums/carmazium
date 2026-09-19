-- TradeXchange remediation — Block 8 follow-up hardening.
--
-- The core Block 8 migration is already recorded in production as
-- tradexchange_lifecycle_matching_abuse_block8. This additive follow-up adds
-- invariants discovered during final reconciliation without rewriting that
-- migration history.

alter table public.contractor_capabilities
    drop constraint if exists contractor_capabilities_approved_job_coverage;

alter table public.contractor_capabilities
    add constraint contractor_capabilities_approved_job_coverage
    check (
        "serviceType" not in ('DELIVERY'::service_type, 'INSPECTION'::service_type)
        or status <> 'APPROVED'::capability_status
        or "jobNationwide"
        or cardinality("jobPostcodeAreas") > 0
    ) not valid;

alter table public.contractor_capabilities
    validate constraint contractor_capabilities_approved_job_coverage;

alter table public.service_jobs
    drop constraint if exists service_jobs_active_work_area_required;

alter table public.service_jobs
    add constraint service_jobs_active_work_area_required
    check (
        status not in (
            'OPEN'::service_job_status,
            'ACCEPTED'::service_job_status,
            'PAID'::service_job_status,
            'IN_PROGRESS'::service_job_status,
            'COMPLETED'::service_job_status,
            'DISPUTED'::service_job_status
        )
        or "workPostcodeArea" is not null
    ) not valid;

alter table public.service_jobs
    validate constraint service_jobs_active_work_area_required;

alter table public.service_leads
    drop constraint if exists service_leads_open_minimum_information;

alter table public.service_leads
    add constraint service_leads_open_minimum_information
    check (
        status <> 'OPEN'
        or (
            (
                nullif(trim(coalesce("vehicleRegistration", '')), '') is not null
                or (
                    nullif(trim(coalesce("vehicleMake", '')), '') is not null
                    and nullif(trim(coalesce("vehicleModel", '')), '') is not null
                )
            )
            and (
                "serviceType" <> 'FINANCE'::service_type
                or (
                    "postcode" is not null
                    and coalesce("vehicleValuePence", 0) > 0
                    and "termMonths" is not null
                    and nullif(trim(coalesce("employmentStatus", '')), '') is not null
                    and (
                        coalesce("monthlyBudgetPence", 0) > 0
                        or coalesce("annualIncomePence", 0) > 0
                    )
                )
            )
        )
    ) not valid;

alter table public.service_leads
    validate constraint service_leads_open_minimum_information;
