-- Removes the obsolete AI-drafted tradexchange_* reference system.
--
-- IMPORTANT:
-- The live TradeXchange marketplace is the Prisma/NestJS service marketplace
-- (`service_jobs`, `service_quotes`, provider capabilities/team access, and the
-- `/services/jobs` API). The objects below were created directly in Supabase as
-- a separate reference design and are not used by application code.
--
-- Production audit 2026-09-17:
--   * all fourteen tradexchange_* tables below contained exactly 0 rows;
--   * repository code contained no calls to the obsolete RPC functions below;
--   * no non-tradexchange table has a foreign-key dependency on these tables;
--   * no public view/materialized view/trigger depends on this reference system;
--   * RLS policies that reference tradexchange_* objects are attached only to
--     the obsolete tradexchange_* tables and disappear with those tables.
--
-- This migration is deliberately defensive. It refuses to run if any obsolete
-- reference table contains data, or if the canonical service_jobs table is not
-- present. Do NOT replace this with prisma db push.

BEGIN;

DO $$
DECLARE
    table_name text;
    row_count bigint;
BEGIN
    IF to_regclass('public.service_jobs') IS NULL THEN
        RAISE EXCEPTION 'Canonical service_jobs table is missing; refusing TradeXchange reference cleanup';
    END IF;

    FOREACH table_name IN ARRAY ARRAY[
        'tradexchange_audit_log',
        'tradexchange_disputes',
        'tradexchange_finance_leads',
        'tradexchange_job_events',
        'tradexchange_jobs',
        'tradexchange_lead_recipients',
        'tradexchange_offers',
        'tradexchange_payments',
        'tradexchange_provider_accounts',
        'tradexchange_service_capabilities',
        'tradexchange_team_members',
        'tradexchange_team_permissions',
        'tradexchange_transactions',
        'tradexchange_warranty_leads'
    ]
    LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO row_count;
            IF row_count <> 0 THEN
                RAISE EXCEPTION 'Refusing cleanup: table % contains % row(s)', table_name, row_count;
            END IF;
        END IF;
    END LOOP;
END
$$;

-- Generic wrapper RPCs that point only at the obsolete reference system.
DROP FUNCTION IF EXISTS public.accept_service_offer(uuid);
DROP FUNCTION IF EXISTS public.admin_trade_provider_capabilities();
DROP FUNCTION IF EXISTS public.cancel_service_job(uuid, text);
DROP FUNCTION IF EXISTS public.confirm_service_job_completion(uuid);
DROP FUNCTION IF EXISTS public.my_provider_summary();
DROP FUNCTION IF EXISTS public.post_service_job(text, text, text, text, text, date, integer, text, text, text, text);
DROP FUNCTION IF EXISTS public.provider_job_feed(text);
DROP FUNCTION IF EXISTS public.provider_lead_feed(text);
DROP FUNCTION IF EXISTS public.report_service_job_issue(uuid, text, text);
DROP FUNCTION IF EXISTS public.service_job_contact(uuid);
DROP FUNCTION IF EXISTS public.service_job_offer_board(uuid);
DROP FUNCTION IF EXISTS public.submit_service_offer(uuid, text, integer, text, date);
DROP FUNCTION IF EXISTS public.withdraw_service_offer(uuid);

-- Reference-system RPCs.
DROP FUNCTION IF EXISTS public.tradexchange_accept_offer(uuid);
DROP FUNCTION IF EXISTS public.tradexchange_accept_team_invite(uuid);
DROP FUNCTION IF EXISTS public.tradexchange_admin_set_capability(text, text, boolean);
DROP FUNCTION IF EXISTS public.tradexchange_admin_update_dispute(uuid, text, text);
DROP FUNCTION IF EXISTS public.tradexchange_can_access_lead(text, text, boolean);
DROP FUNCTION IF EXISTS public.tradexchange_can_provide(text, text);
DROP FUNCTION IF EXISTS public.tradexchange_invite_team_member(text, text, text);
DROP FUNCTION IF EXISTS public.tradexchange_is_admin();
DROP FUNCTION IF EXISTS public.tradexchange_my_provider_contexts();
DROP FUNCTION IF EXISTS public.tradexchange_open_dispute(uuid, text);
DROP FUNCTION IF EXISTS public.tradexchange_owns_dealer(text);
DROP FUNCTION IF EXISTS public.tradexchange_revoke_team_member(uuid);
DROP FUNCTION IF EXISTS public.tradexchange_set_team_permission(uuid, text, boolean, boolean, boolean, boolean);
DROP FUNCTION IF EXISTS public.tradexchange_settle_checkout(uuid, text, uuid, text, text, integer, text);
DROP FUNCTION IF EXISTS public.tradexchange_staff_of_dealer(text);
DROP FUNCTION IF EXISTS public.tradexchange_submit_lead(text, text, jsonb, jsonb, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.tradexchange_submit_offer(uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.tradexchange_update_job_progress(uuid, text);
DROP FUNCTION IF EXISTS public.tradexchange_update_lead_status(uuid, text);

-- Drop child tables first so no CASCADE is required. If an unexpected external
-- dependency exists, PostgreSQL stops the transaction rather than silently
-- deleting that dependent object.
DROP TABLE IF EXISTS public.tradexchange_disputes;
DROP TABLE IF EXISTS public.tradexchange_job_events;
DROP TABLE IF EXISTS public.tradexchange_team_permissions;
DROP TABLE IF EXISTS public.tradexchange_team_members;
DROP TABLE IF EXISTS public.tradexchange_lead_recipients;
DROP TABLE IF EXISTS public.tradexchange_offers;
DROP TABLE IF EXISTS public.tradexchange_payments;
DROP TABLE IF EXISTS public.tradexchange_transactions;
DROP TABLE IF EXISTS public.tradexchange_finance_leads;
DROP TABLE IF EXISTS public.tradexchange_warranty_leads;
DROP TABLE IF EXISTS public.tradexchange_service_capabilities;
DROP TABLE IF EXISTS public.tradexchange_provider_accounts;
DROP TABLE IF EXISTS public.tradexchange_audit_log;
DROP TABLE IF EXISTS public.tradexchange_jobs;

COMMIT;
