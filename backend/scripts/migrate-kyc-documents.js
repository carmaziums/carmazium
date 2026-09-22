/**
 * Move dealer KYC identity documents out of public storage.
 *
 * 43 objects sit under `listings/kyc/` in a PUBLIC bucket — passports, driving
 * licences, proof of address, VAT and Companies House certificates — each with
 * a permanent URL readable by anyone who has it. New uploads already go to the
 * private bucket; this moves the historic ones.
 *
 * Driven from the database, not from a storage listing: for every dealer_kycs
 * row it reads the four legacy URL columns, so anything it migrates is a file a
 * KYC record actually points at, and the row is updated in the same step. A
 * storage-first walk could copy an orphan and leave a record pointing nowhere.
 *
 * It NEVER deletes. Copy, verify, repoint — then a human decides about the
 * originals once the private copies are confirmed good.
 *
 *   node scripts/migrate-kyc-documents.js            # dry run, changes nothing
 *   node scripts/migrate-kyc-documents.js --apply    # copy + repoint
 *
 * Needs SUPABASE_URL, SUPABASE_SERVICE_KEY and DATABASE_URL in the environment.
 */
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const PUBLIC_BUCKET = 'listings';
const PRIVATE_BUCKET = 'dealer-kyc-documents';

const FIELDS = [
    { legacy: 'vatProof', path: 'vatProofPath' },
    { legacy: 'companyRegistrationProof', path: 'companyRegistrationProofPath' },
    { legacy: 'directorIdProof', path: 'directorIdProofPath' },
    { legacy: 'proofOfAddress', path: 'proofOfAddressPath' },
    // Added after the orphan audit found four objects referenced only here.
    { legacy: 'paymentScreenshot', path: 'paymentScreenshotPath' },
];

const EXT_BY_MIME = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
};

const apply = process.argv.includes('--apply');

/** Object key inside `listings`, or null when the value is not such a URL. */
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

    console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (no changes) ===\n');

    const rows = await prisma.dealerKyc.findMany({
        select: {
            id: true,
            dealerProfileId: true,
            ...Object.fromEntries(FIELDS.flatMap(f => [[f.legacy, true], [f.path, true]])),
        },
    });

    let pending = 0, migrated = 0, skipped = 0, failed = 0;
    const migratedKeys = new Set();

    for (const row of rows) {
        for (const field of FIELDS) {
            const legacyUrl = row[field.legacy];
            const existingPath = row[field.path];
            const key = publicObjectKey(legacyUrl);

            if (!key) continue;
            if (existingPath) { skipped++; continue; }   // already private
            pending++;

            if (!apply) {
                console.log(`  would migrate  kyc ${row.id}  ${field.legacy}  <- ${key}`);
                continue;
            }

            try {
                const dl = await supabase.storage.from(PUBLIC_BUCKET).download(key);
                if (dl.error || !dl.data) throw new Error(`download: ${dl.error?.message || 'no data'}`);

                const buffer = Buffer.from(await dl.data.arrayBuffer());
                const mime = dl.data.type || 'application/octet-stream';
                const ext = EXT_BY_MIME[mime] || key.split('.').pop() || 'bin';
                const destination = `${row.dealerProfileId}/${field.legacy}/${randomUUID()}.${ext}`;

                const up = await supabase.storage.from(PRIVATE_BUCKET).upload(destination, buffer, {
                    contentType: mime,
                    cacheControl: 'no-store',
                    upsert: false,
                });
                if (up.error) throw new Error(`upload: ${up.error.message}`);

                // Verify the private copy is readable and the same size before
                // the record is repointed at it.
                const check = await supabase.storage.from(PRIVATE_BUCKET).download(destination);
                if (check.error || !check.data) throw new Error(`verify: ${check.error?.message || 'unreadable'}`);
                const checkSize = Buffer.from(await check.data.arrayBuffer()).length;
                if (checkSize !== buffer.length) {
                    throw new Error(`verify: size ${checkSize} != ${buffer.length}`);
                }

                await prisma.dealerKyc.update({
                    where: { id: row.id },
                    data: { [field.path]: destination },
                });

                migratedKeys.add(key);
                migrated++;
                console.log(`  migrated  ${field.legacy}  ${key}  ->  ${destination}`);
            } catch (e) {
                failed++;
                console.error(`  FAILED    ${field.legacy}  ${key}  :: ${e.message}`);
            }
        }
    }

    // Anything under kyc/ that no KYC record references. Still public, still
    // someone's identity document, but not reachable through the app.
    const orphans = [];
    let offset = 0;
    for (;;) {
        const { data, error } = await supabase.storage.from(PUBLIC_BUCKET)
            .list('kyc', { limit: 100, offset });
        if (error) { console.error(`  could not list kyc/: ${error.message}`); break; }
        if (!data || data.length === 0) break;
        for (const o of data) {
            const key = `kyc/${o.name}`;
            if (!migratedKeys.has(key)) orphans.push(key);
        }
        if (data.length < 100) break;
        offset += 100;
    }

    console.log('\n--- summary ---');
    console.log(`  records scanned        ${rows.length}`);
    console.log(`  already private        ${skipped}`);
    console.log(apply ? `  migrated               ${migrated}` : `  would migrate          ${pending}`);
    if (failed) console.log(`  FAILED                 ${failed}`);
    console.log(`  kyc/ objects not migrated by this run: ${orphans.length}`);
    for (const o of orphans.slice(0, 50)) console.log(`      ${o}`);
    console.log('\nNothing was deleted. Confirm the private copies open in admin review,');
    console.log('then remove the public originals as a separate, deliberate step.');

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
