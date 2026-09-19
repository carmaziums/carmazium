-- TradeXchange marketplace reliability — automatic rematching.
--
-- Production migration applied through Supabase on 2026-09-19 as
-- tradexchange_auto_lead_rematch.
--
-- AUTO_REMATCH distinguishes lifecycle/provider-approval rematching from a
-- deliberate administrator rematch while preserving the existing audit field.

alter table public.service_lead_recipients
    drop constraint if exists service_lead_recipients_match_source_check;

alter table public.service_lead_recipients
    add constraint service_lead_recipients_match_source_check
    check ("matchSource" in ('AUTO', 'ADMIN_REMATCH', 'AUTO_REMATCH')) not valid;

alter table public.service_lead_recipients
    validate constraint service_lead_recipients_match_source_check;
