/**
 * Move auction handover proof out of public storage.
 *
 * Handover proof — photographs of a vehicle changing hands and, in at least one
 * live case, a signed PDF handover document carrying both parties' names and
 * addresses — was uploaded from the browser into the PUBLIC `listings` bucket
 * and its permanent public URL stored on the auction. It is also the evidence
 * that releases a £100 payout. New web uploads already go to the private
 * bucket; this moves the historic ones.
 *
 * Driven from the database, not from a storage listing: for every auction row
 * it reads handoverProofUrl, so anything it migrates is a file an auction
 * actually points at, and the row is repointed in the same step.
 *
 * It NEVER deletes. Copy, verify, repoint — a human decides about the originals
 * once the private copies are confirmed good (see cleanup-public-handover.js).
 *
 *   node scripts/migrate-handover-documents.js            # dry run
 *   node scripts/migrate-handover-documents.js --apply    # copy + repoint
 *
 * Needs SUPABASE_URL, SUPABASE_SERVICE_KEY and DATABASE_URL in the environment.
 */
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const PUBLIC_BUCKET = 'listings';
const PRIVATE_BUCKET = 'auction-handover-documents';

const EXT_BY_MIME = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
};

const apply = process.argv.includes('--apply');

/**
 * Object key inside `listings`, or null when the value is not such a URL.
 *
 * Accepts both the web prefix (`handover/<auctionId>/...`) and the one the
 * released mobile app uses (`<userId>/handover/...`), because both are public
 * and both need moving.
 */
function publicObjectKey(url) {
    if (typeof url !== 'string') return null;
    const marker = `/storage/v1/object/public/${PUBLIC_BUCKET}/`;
    const at = url.indexOf(marker);
    if (at === -1) return null;
    const key = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
    return key.startsWith('handover/') || key.includes('/handover/') ? key : null;
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

    let pending = 0, migrated = 0, skipped = 0, failed = 0;
    const migratedKeys = new Set();

    for (const row of rows) {
        const key = publicObjectKey(row.handoverProofUrl);
        if (!key) continue;
        if (row.handoverProofPath) { skipped++; continue; }   // already private
        pending++;

        if (!apply) {
            console.log(`  would migrate  auction ${row.id}  <- ${key}`);
            continue;
        }

        try {
            const dl = await supabase.storage.from(PUBLIC_BUCKET).download(key);
            if (dl.error || !dl.data) throw new Error(`download: ${dl.error?.message || 'no data'}`);

            const buffer = Buffer.from(await dl.data.arrayBuffer());
            const mime = dl.data.type || 'application/octet-stream';
            const ext = EXT_BY_MIME[mime] || key.split('.').pop() || 'bin';
            const destination = `${row.id}/${randomUUID()}.${ext}`;

            const up = await supabase.storage.from(PRIVATE_BUCKET).upload(destination, buffer, {
                contentType: mime,
                cacheControl: 'no-store',
                upsert: false,
            });
            if (up.error) throw new Error(`upload: ${up.error.message}`);

            // Verify the private copy is readable and the same size before the
            // record is repointed at it.
            const check = await supabase.storage.from(PRIVATE_BUCKET).download(destination);
            if (check.error || !check.data) throw new Error(`verify: ${check.error?.message || 'unreadable'}`);
            const checkSize = Buffer.from(await check.data.arrayBuffer()).length;
            if (checkSize !== buffer.length) {
                throw new Error(`verify: size ${checkSize} != ${buffer.length}`);
            }

            await prisma.auction.update({
                where: { id: row.id },
                data: { handoverProofPath: destination },
            });

            migratedKeys.add(key);
            migrated++;
            console.log(`  migrated  ${key}  ->  ${destination}`);
        } catch (e) {
            failed++;
            console.error(`  FAILED    ${key}  :: ${e.message}`);
        }
    }

    console.log('\n--- summary ---');
    console.log(`  auctions with a proof URL  ${rows.length}`);
    console.log(`  already private            ${skipped}`);
    console.log(apply ? `  migrated                   ${migrated}` : `  would migrate              ${pending}`);
    if (failed) console.log(`  FAILED                     ${failed}`);
    console.log('\nNothing was deleted. Confirm the private copies open in admin review,');
    console.log('then run cleanup-public-handover.js as a separate, deliberate step.');
    console.log('handoverProofUrl is left set on purpose so nothing is lost if a copy');
    console.log('needs re-checking; once the public object is deleted the app reads the');
    console.log('private path, which it already prefers whenever one exists.');

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
