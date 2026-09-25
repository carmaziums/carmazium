-- TradeXchange infrastructure hardening — cover every remaining FK
-- reported by the Supabase performance advisor on 2026-09-19.
--
-- Applied to production through Supabase migration:
-- 20260919224413_tradexchange_fk_indexes

create index if not exists contractor_capabilities_reviewed_by_idx
    on public.contractor_capabilities ("reviewedById");

create index if not exists service_capability_status_history_admin_idx
    on public.service_capability_status_history ("adminId");

create index if not exists service_job_vehicles_listing_idx
    on public.service_job_vehicles ("listingId");

create index if not exists service_leads_listing_idx
    on public.service_leads ("listingId");

create index if not exists service_payments_customer_idx
    on public.service_payments ("customerId");

create index if not exists service_quotes_submitted_by_idx
    on public.service_quotes ("submittedById");

create index if not exists service_settlement_operations_admin_idx
    on public.service_settlement_operations ("adminId");

create index if not exists service_settlement_operations_payment_idx
    on public.service_settlement_operations ("paymentId");

create index if not exists trade_service_team_action_log_contractor_idx
    on public.trade_service_team_action_log ("contractorProfileId");

create index if not exists trade_service_team_action_log_dealer_idx
    on public.trade_service_team_action_log ("dealerProfileId");
