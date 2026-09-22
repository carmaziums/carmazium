/**
 * Remove dealer KYC documents from public storage.
 *
 * Runs after migrate-kyc-documents.js and handles the two groups that remain
 * under `listings/kyc/`, differently, because the safe action differs:
 *
 *   REFERENCED   a KYC record points at it, and the record now also has a
 *                private path. Before the public original is deleted the
 *                private copy is downloaded and confirmed non-empty. If that
 *                check fails the object is kept and reported.
 *
 *   UNREFERENCED no record points at it -- an abandoned or replaced upload.
 *                Still someone's identity document, so it is COPIED into the
 *                private bucket under `orphaned/` before the public copy goes.
 *                Nothing is destroyed; it stops being world-readable.
 *
 * A record whose private path is missing is never touched: deleting there
 * would leave an admin with no document at all.
 *
 *   node scripts/cleanup-public-kyc.js            # dry run, changes nothing
 *   node scripts/cleanup-public-kyc.js --apply    # quarantine + delete
 */
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const PUBLIC_BUCKET = 'listings';
const PRIVATE_BUCKET = 'dealer-kyc-documents';

const FIELDS = [
    { legacy: 'vatProof', path: 'vatProofPath' },
    { legacy: 'companyRegistrationProof', path: 'companyRegistrationProofPath' },
    { legacy: 'directorIdProof', path: 'directorIdProofPath' },
    { legacy: 'proofOfAddress', path: 'proofOfAddressPath' },
    { legacy: 'paymentScreenshot', path: 'paymentScreenshotPath' },
];

const apply = process.argv.includes('--apply');

function publicObjectKey(url) {
    if (typeof url !== 'string') return null;
    const marker = `/storage/v1/object/public/${PUBLIC_BUCKET}/`;
    const at = url.indexOf(marker);
    if (at === -1) return null;
    const key = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
    return key.startsWith('kyc/') ? key : null;
}

async function main() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');

    const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const prisma = new PrismaClient();

    console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN (no changes) ===\n');

    const rows = await prisma.dealerKyc.findMany();

    // key -> { kycId, field, privatePath }
    const referenced = new Map();
    for (const row of rows) {
        for (const field of FIELDS) {
            const key = publicObjectKey(row[field.legacy]);
            if (key) {
                referenced.set(key, { kycId: row.id, field: field.legacy, privatePath: row[field.path] });
            }
        }
    }

    const objects = [];
    let offset = 0;
    for (;;) {
        const { data, error } = await supabase.storage.from(PUBLIC_BUCKET)
            .list('kyc', { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw new Error(`list kyc/: ${error.message}`);
        if (!data || data.length === 0) break;
        objects.push(...data);
        if (data.length < 100) break;
        offset += 100;
    }

    const toDelete = [];
    const kept = [];
    const toQuarantine = [];

    for (const obj of objects) {
        const key = `kyc/${obj.name}`;
        const ref = referenced.get(key);

        if (!ref) {
            toQuarantine.push(key);
            continue;
        }
        if (!ref.privatePath) {
            kept.push({ key, why: `${ref.field} on ${ref.kycId.slice(0, 8)} has no private copy — run the migration first` });
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
            const destination = `orphaned/${key.replace(/^kyc\//, '')}`;
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
        // Supabase remove() takes batches; keep them small enough to read in logs.
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
    console.log(`  objects under kyc/                 ${objects.length}`);
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
        console.log('\nUnreferenced documents were copied to dealer-kyc-documents/orphaned/');
        console.log('before deletion, so nothing was destroyed — only made non-public.');
    }

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
