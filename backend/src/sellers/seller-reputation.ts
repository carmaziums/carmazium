/**
 * Live seller reputation figures, derived from real marketplace activity.
 *
 * `SellerProfile.responseRate` and `avgResponseHours` used to be stored
 * columns that nothing ever wrote, so every seller showed "0% response rate"
 * and lost 30% of their reliability score. These helpers compute them from
 * the offers a seller actually received and answered.
 */

/** Offers still awaiting a reply get this long before they count as unanswered. */
export const RESPONSE_GRACE_MS = 48 * 60 * 60 * 1000;
const RESPONDED = ['ACCEPTED', 'REJECTED', 'COUNTERED'] as const;

export interface OfferForResponse {
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ResponseStats {
    /** 0–100, or null when the seller has not yet received an offer to answer. */
    responseRate: number | null;
    /** Mean hours from offer to first seller decision, or null with no answers. */
    avgResponseHours: number | null;
    offersConsidered: number;
}

export function computeResponseStats(offers: OfferForResponse[], now = Date.now()): ResponseStats {
    let considered = 0;
    let responded = 0;
    let totalMs = 0;
    for (const o of offers) {
        // A buyer withdrawing or cancelling isn't a question the seller ignored.
        if (o.status === 'WITHDRAWN' || o.status === 'CANCELLED') continue;
        // A fresh pending offer still has time to be answered.
        if (o.status === 'PENDING' && now - o.createdAt.getTime() < RESPONSE_GRACE_MS) continue;
        considered += 1;
        if ((RESPONDED as readonly string[]).includes(o.status)) {
            responded += 1;
            totalMs += Math.max(0, o.updatedAt.getTime() - o.createdAt.getTime());
        }
    }
    return {
        responseRate: considered > 0 ? Math.round((responded / considered) * 100) : null,
        avgResponseHours: responded > 0 ? Math.round((totalMs / responded / 3_600_000) * 10) / 10 : null,
        offersConsidered: considered,
    };
}

/**
 * Reliability Score (0–5): avgRating*0.5 + responseRate*0.3 + salesRatio*0.2,
 * each part on a 0–5 scale. Unchanged formula; a seller with no offers yet
 * scores 0 on the response part, exactly as before.
 */
export function computeReliabilityScore(input: {
    ratings: number[];
    responseRate: number | null;
    totalSales: number;
    totalListings: number;
}): number {
    const avgRating = input.ratings.length
        ? input.ratings.reduce((s, r) => s + r, 0) / input.ratings.length
        : 0;
    const responseScore = ((input.responseRate ?? 0) / 100) * 5;
    const salesRatio = input.totalListings > 0 ? input.totalSales / input.totalListings : 0;
    const salesScore = Math.min(salesRatio, 1) * 5;
    const raw = avgRating * 0.5 + responseScore * 0.3 + salesScore * 0.2;
    return Math.min(Math.max(Math.round(raw * 10) / 10, 0), 5);
}

/** Prisma-shaped loader: the last 200 offers on the seller's listings. */
export async function loadResponseStats(
    prisma: { offer: { findMany: (args: any) => Promise<OfferForResponse[]> } },
    sellerUserId: string,
): Promise<ResponseStats> {
    const offers = await prisma.offer.findMany({
        where: { listing: { sellerId: sellerUserId } },
        select: { status: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });
    return computeResponseStats(offers);
}
