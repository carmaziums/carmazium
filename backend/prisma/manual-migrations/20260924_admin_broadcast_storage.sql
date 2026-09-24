-- Dedicated storage for admin broadcast media.
--
-- Applied to production Supabase on 2026-09-24.
-- Keeps large admin videos isolated from the shared listings bucket and removes
-- two permissive public INSERT policies that unintentionally bypassed listing
-- media ownership restrictions.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'admin-broadcasts',
  'admin-broadcasts',
  true,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Restore listings to the hardened marketplace-media contract.
update storage.buckets
set
  file_size_limit = 15728640,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]::text[]
where id = 'listings';

-- These old PERMISSIVE policies were named as blockers but actually granted
-- INSERT for almost every listings path. The owner-scoped authenticated policy
-- remains the intended upload path for listings/KYC/handover compatibility.
drop policy if exists "Block public KYC uploads" on storage.objects;
drop policy if exists "Block public handover uploads" on storage.objects;

drop policy if exists "Public read admin broadcasts" on storage.objects;
drop policy if exists "Admins upload admin broadcasts" on storage.objects;
drop policy if exists "Admins update admin broadcasts" on storage.objects;
drop policy if exists "Admins delete admin broadcasts" on storage.objects;

create policy "Public read admin broadcasts"
on storage.objects
for select
to public
using (bucket_id = 'admin-broadcasts');

create policy "Admins upload admin broadcasts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'admin-broadcasts'
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())::text
      and u.role::text = 'ADMIN'
  )
);

create policy "Admins update admin broadcasts"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'admin-broadcasts'
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())::text
      and u.role::text = 'ADMIN'
  )
)
with check (
  bucket_id = 'admin-broadcasts'
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())::text
      and u.role::text = 'ADMIN'
  )
);

create policy "Admins delete admin broadcasts"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'admin-broadcasts'
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())::text
      and u.role::text = 'ADMIN'
  )
);
