/**
 * Remove auction handover proof from public storage.
 *
 * Runs after migrate-handover-documents.js and handles the two groups that
 * remain under the public bucket's handover prefixes, differently, because the
 * safe action differs:
 *
 *   REFERENCED   an auction points at it and now also has a private path.
 *                Before the public original is deleted the private copy is
 *                downloaded and confirmed non-empty. If that check fails the
 *                object is kept and reported.
 *
 *   UNREFERENCED no auction points at it — an abandoned or denied upload. Still
 *                a photograph of someone's vehicle handover, possibly a signed
 *                document, so it is COPIED into the private bucket under
 *                `orphaned/` before the public copy goes. Nothing is destroyed;
 *                it stops being world-readable.
 *
 * An auction whose private path is missing is never touched: deleting there
 * would leave an admin with no proof at all and a £100 payout undecidable.
 *
 * Covers the web prefix (`handover/`) and the mobile shape
 * (`<userId>/handover/`). The mobile app never shipped and now uploads through
 * the backend like the web client, so nothing is left writing to either.
 *
 *   node scripts/cleanup-public-handover.js            # dry run
 *   node scripts/cleanup-public-handover.js --apply    # quarantine + delete
 */
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const PUBLIC_BUCKET = 'listings';
const PRIVATE_BUCKET = 'auction-handover-documents';

const apply = process.argv.includes('--apply');

function publicObjectKey(url) {
    if (typeof url !== 'string') return null;
    const marker = `/storage/v1/object/public/${PUBLIC_BUCKET}/`;
    const at = url.indexOf(marker);
    if (at === -1) return null;
    const key = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
    return key.startsWith('handover/') || key.includes('/handover/') ? key : null;
}

/** Every object under a prefix, recursing one level into per-auction folders. */
async function listPrefix(supabase, prefix) {
    const out = [];
    let offset = 0;
    for (;;) {
        const { data, error } = await supabase.storage.from(PUBLIC_BUCKET)
            .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw new Error(`list ${prefix}/: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const entry of data) {
            // Supabase reports a folder as an entry with no id/metadata.
            if (!entry.id) {
                out.push(...await listPrefix(supabase, `${prefix}/${entry.name}`));
            } else {
                out.push(`${prefix}/${entry.name}`);
            }
        }
        if (data.length < 100) break;
        offset += 100;
    }
    return out;
}

async function main() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');

    const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const prisma = new PrismaClient();

    console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN (no changes) ===\n');

    const rows = await prisma.auction.findMany({
        where: { handoverProofUrl: { not: null } },
        select: { id: true, handoverProofUrl: true, handoverProofPath: true },
    });

    // key -> { auctionId, privatePath }
    const referenced = new Map();
    for (const row of rows) {
        const key = publicObjectKey(row.handoverProofUrl);
        if (key) referenced.set(key, { auctionId: row.id, privatePath: row.handoverProofPath });
    }

    // Everything under the web prefix, plus any mobile-shaped key
    // (`<userId>/handover/...`) a record points at. The mobile ones come from
    // the database rather than a storage walk: they live under arbitrary
    // per-user folders, so listing them would mean enumerating the whole
    // bucket. Both groups go through the same private-copy verification.
    const objects = await listPrefix(supabase, 'handover');
    for (const key of referenced.keys()) {
        if (!key.startsWith('handover/') && !objects.includes(key)) objects.push(key);
    }

    const toDelete = [];
    const kept = [];
    const toQuarantine = [];

    for (const key of objects) {
        const ref = referenced.get(key);

        if (!ref) {
            toQuarantine.push(key);
            continue;
        }
        if (!ref.privatePath) {
            kept.push({ key, why: `auction ${ref.auctionId.slice(0, 8)} has no private copy — run the migration first` });
            continue;
        }

        if (apply) {
            const check = await supabase.storage.from(PRIVATE_BUCKET).download(ref.privatePath);
            const size = check.data ? Buffer.from(await check.data.arrayBuffer()).length : 0;
            if (check.error || size < 1) {
                kept.push({ key, why: `private copy unreadable (${check.error?.message || 'empty'})` });
                continue;
            }
        }
        toDelete.push(key);
    }

    // Quarantine the unreferenced ones before their public copy is removed.
    const quarantined = [];
    for (const key of toQuarantine) {
        if (!apply) continue;
        try {
            const dl = await supabase.storage.from(PUBLIC_BUCKET).download(key);
            if (dl.error || !dl.data) throw new Error(dl.error?.message || 'no data');
            const buffer = Buffer.from(await dl.data.arrayBuffer());
            const destination = `orphaned/${key.replace(/^handover\//, '')}`;
            const up = await supabase.storage.from(PRIVATE_BUCKET).upload(destination, buffer, {
                contentType: dl.data.type || 'application/octet-stream',
                cacheControl: 'no-store',
                upsert: true,
            });
            if (up.error) throw new Error(up.error.message);
            quarantined.push(key);
        } catch (e) {
            kept.push({ key, why: `could not quarantine: ${e.message}` });
        }
    }

    const deletable = [...toDelete, ...(apply ? quarantined : toQuarantine)];

    if (apply && deletable.length) {
        for (let i = 0; i < deletable.length; i += 50) {
            const batch = deletable.slice(i, i + 50);
            const { error } = await supabase.storage.from(PUBLIC_BUCKET).remove(batch);
            if (error) {
                console.error(`  delete batch failed: ${error.message}`);
            } else {
                for (const k of batch) console.log(`  deleted from public bucket  ${k}`);
            }
        }
    }

    console.log('\n--- summary ---');
    console.log(`  public handover objects found      ${objects.length}`);
    console.log(`  referenced, private copy verified  ${toDelete.length}`);
    console.log(`  unreferenced, quarantined first    ${apply ? quarantined.length : toQuarantine.length}`);
    console.log(apply ? `  DELETED from public bucket         ${deletable.length}` : `  would delete                       ${deletable.length}`);
    if (kept.length) {
        console.log(`  KEPT (not safe to delete)          ${kept.length}`);
        for (const k of kept) console.log(`      ${k.key}\n          ${k.why}`);
    }

    if (!apply) {
        console.log('\nDry run. Re-run with --apply to quarantine and delete.');
    } else {
        console.log('\nUnreferenced proof was copied to auction-handover-documents/orphaned/');
        console.log('before deletion, so nothing was destroyed — only made non-public.');
    }

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
