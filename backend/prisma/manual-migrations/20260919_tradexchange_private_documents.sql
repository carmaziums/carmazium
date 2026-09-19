-- TradeXchange remediation — Block 1: private document storage.
--
-- Verification documents and dispute evidence are private operational records.
-- They must never be delivered from the public listings bucket or stored as
-- permanent public URLs. The Nest backend is the sole upload/signing boundary.
--
-- Safe for production on 2026-09-19:
-- the pre-migration audit found 0 service_case_entries rows and 0
-- TradeXchange verification/dispute objects in the listings bucket.

alter table public.service_case_entries
    add column if not exists "storagePath" text;

create index if not exists service_case_entries_storage_path_idx
    on public.service_case_entries ("storagePath")
    where "storagePath" is not null;

-- Defence in depth for any legacy/future rows: private attachment records must
-- not retain a permanent public URL. Current production row count is zero.
update public.service_case_entries
set "url" = null
where "scope" in ('CAPABILITY', 'DISPUTE')
  and "url" is not null;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'tradexchange-documents',
    'tradexchange-documents',
    false,
    10485760,
    array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[]
)
on conflict (id) do update
set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- There are deliberately NO anon/authenticated storage.objects policies for
-- tradexchange-documents. The service-role backend writes and signs objects.

-- Old released TradeXchange pages wrote to:
--   listings/{uid}/service-verification/...
--   listings/{uid}/service-disputes/...
-- Keep all valid listing media behaviour intact, but explicitly reject those
-- two private-document folders so stale clients cannot recreate the exposure.
drop policy if exists "Authenticated users upload own listing media" on storage.objects;

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
        (
            (storage.foldername(name))[1] = (select auth.uid())::text
            and coalesce((storage.foldername(name))[2], '') not in (
                'service-verification',
                'service-disputes'
            )
        )
        or (
            -- Transitional compatibility for already-released mobile clients.
            (storage.foldername(name))[1] = any (
                array['kyc'::text, 'handover'::text]
            )
            and (storage.foldername(name))[2] = (select auth.uid())::text
        )
    )
);
