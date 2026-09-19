-- CarMazium production listing-media Storage policy.
--
-- The listings bucket stays public because vehicle/listing images are public
-- marketplace assets. Public delivery does not require a storage.objects SELECT
-- policy, so object metadata/listing remains private while downloads keep working.
--
-- Applied to the production Supabase project on 2026-09-19.

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

drop policy if exists "Allow Public Viewing" on storage.objects;
drop policy if exists "Authenticated users upload own listing media" on storage.objects;
drop policy if exists "Authenticated users read own listing vehicle media" on storage.objects;
drop policy if exists "Authenticated users delete own listing media" on storage.objects;

create policy "Authenticated users upload own listing media"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'listings'
    and lower(storage.extension(name)) = any (
        array[
            'jpg'::text,
            'jpeg'::text,
            'png'::text,
            'webp'::text,
            'avif'::text,
            'heic'::text,
            'heif'::text,
            'pdf'::text
        ]
    )
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or (
            -- Transitional compatibility for already-released mobile clients.
            -- Remove after clients using kyc/{uid}/... and handover/{uid}/...
            -- have been retired.
            (storage.foldername(name))[1] = any (
                array['kyc'::text, 'handover'::text]
            )
            and (storage.foldername(name))[2] = (select auth.uid())::text
        )
    )
);

-- Storage remove() requires both SELECT and DELETE. Limit both to the user's
-- vehicle-photo namespace; KYC/handover documents cannot be deleted directly
-- from a seller client.
create policy "Authenticated users read own listing vehicle media"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'listings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = any (
        array['vehicle'::text, 'exterior'::text, 'interior'::text, 'damage'::text]
    )
);

create policy "Authenticated users delete own listing media"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'listings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = any (
        array['vehicle'::text, 'exterior'::text, 'interior'::text, 'damage'::text]
    )
);
