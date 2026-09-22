/**
 * Classify every remaining object under `listings/kyc/` before anything is
 * deleted.
 *
 * After the migration, 21 objects were left that the four document columns do
 * not reference. "Unreferenced by those four" is NOT the same as "safe to
 * delete": paymentScreenshot is a fifth column that can hold a kyc/ URL, and a
 * file could be referenced by a record this script should find rather than
 * assume away. Each object is checked against EVERY text column on dealer_kycs.
 *
 * Read-only. Deletes nothing, changes nothing.
 *
 *   node scripts/audit-kyc-orphans.js
 */
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const PUBLIC_BUCKET = 'listings';

async function main() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');

    const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const prisma = new PrismaClient();

    // 1. Everything still sitting under kyc/ in the public bucket.
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

    // 2. Every KYC row, whole, so any column can be searched.
    const rows = await prisma.dealerKyc.findMany();

    const referencedBy = (needle) => {
        const hits = [];
        for (const row of rows) {
            for (const [column, value] of Object.entries(row)) {
                if (typeof value === 'string' && value.includes(needle)) {
                    hits.push({ kycId: row.id, column });
                }
            }
        }
        return hits;
    };

    const orphans = [];
    const referenced = [];

    for (const obj of objects) {
        const hits = referencedBy(obj.name);
        if (hits.length === 0) orphans.push(obj);
        else referenced.push({ obj, hits });
    }

    console.log(`objects under listings/kyc/ : ${objects.length}`);
    console.log(`referenced by a KYC record  : ${referenced.length}`);
    console.log(`referenced by NOTHING       : ${orphans.length}\n`);

    if (referenced.length) {
        console.log('--- still referenced (DO NOT DELETE) ---');
        for (const { obj, hits } of referenced) {
            const where = hits.map(h => `${h.column}@${h.kycId.slice(0, 8)}`).join(', ');
            console.log(`  ${obj.name}\n      ${where}`);
        }
        console.log();
    }

    console.log('--- unreferenced ---');
    for (const o of orphans) {
        const size = o.metadata?.size ?? '?';
        const created = o.created_at ? String(o.created_at).slice(0, 10) : '?';
        console.log(`  ${o.name}   ${size} bytes   uploaded ${created}`);
    }

    console.log('\nThese are still identity documents and still public. Unreferenced');
    console.log('means no KYC record points at them -- abandoned or replaced uploads --');
    console.log('not that they are harmless. Nothing was deleted by this script.');

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
