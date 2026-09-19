-- TradeXchange follow-up security hardening.
--
-- Applied to production through Supabase migration
-- 20260919204206_tradexchange_provider_profiles_backend_only.
--
-- ContractorProfile contains server-owned trust fields such as rating,
-- totalReviews and serviceTypes. Browser clients must not be able to mutate
-- those fields by bypassing the Nest backend.

alter table public.contractor_profiles enable row level security;

drop policy if exists contractor_self_write on public.contractor_profiles;
drop policy if exists contractor_read on public.contractor_profiles;

revoke all on table public.contractor_profiles from anon;
revoke insert, update, delete on table public.contractor_profiles from authenticated;
grant select on table public.contractor_profiles to authenticated;

create policy contractor_read
on public.contractor_profiles
for select
to authenticated
using (
    "userId" = (select auth.uid())::text
    or (select is_admin())
);
