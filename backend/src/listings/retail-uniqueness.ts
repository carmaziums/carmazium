import type { PrismaService } from '../prisma/prisma.service';

/**
 * Resolve duplicate *live retail* registration plates before approving a new
 * advert or relisting a withdrawn one. SQL canonicalises whitespace/hyphens
 * safely and excludes the record being edited.
 *
 * This is a conflict gate only: no automatic record deletion or seller
 * ownership assertion. Staff must verify transfer and withdraw outdated ads.
 */
export async function hasOtherActiveRetailRegistration(
    prisma: Pick<PrismaService, '$queryRaw'>,
    candidate: { id: string; type: string; vrm?: string | null },
): Promise<boolean> {
    if (candidate.type !== 'CLASSIFIED' || !candidate.vrm) return false;
    const plate = candidate.vrm.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (plate.length < 2 || plate.length > 7) return false;
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.listings
        WHERE "type"='CLASSIFIED' AND "status"='ACTIVE'
          AND "deletedAt" IS NULL AND id <> ${candidate.id}
          AND regexp_replace(upper(vrm), '[^A-Z0-9]', '', 'g') = ${plate}
        LIMIT 1
    `;
    return Array.isArray(rows) && rows.some(row => typeof row.id === 'string' && row.id !== candidate.id);
}
