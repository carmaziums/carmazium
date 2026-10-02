import type { ValuationEvidenceKind } from './vehicle-valuation';

export type ChannelEvidenceBasis = 'OBSERVED' | 'PROVISIONAL_PROXY';
export type ChannelObservation = {
    value: number;
    weight: number;
    kind: ValuationEvidenceKind;
    saleChannel?: 'RETAIL' | 'PRIVATE' | 'AUCTION' | null;
    verifiedAuctionSale?: boolean;
    verifiedPrivateSale?: boolean;
    channelValue?: number;
};

export interface MarketChannelGuides {
    retail: {
        suggestedAsking: number;
        suggestedMinimum: number;
        evidenceBasis: ChannelEvidenceBasis;
        observedAsks: number;
    };
    privateSale: {
        low: number;
        mid: number;
        high: number;
        evidenceBasis: ChannelEvidenceBasis;
        verifiedSales: number;
    };
    auction: {
        marketValue: number;
        openingBid: number;
        reserveLow: number;
        reserveHigh: number;
        suggestedReserve: number;
        evidenceBasis: ChannelEvidenceBasis;
        verifiedOutcomes: number;
    };
}

export function roundChannelMoney(value: number): number {
    const safe = Math.max(500, value);
    return Math.round(safe / (safe < 10_000 ? 50 : 100)) * (safe < 10_000 ? 50 : 100);
}

function weightedQuantile(
    observations: Array<{ value: number; weight: number }>,
    fraction: number,
): number {
    const sorted = observations
        .filter((row) => Number.isFinite(row.value) && row.value >= 250
            && Number.isFinite(row.weight) && row.weight > 0)
        .sort((a, b) => a.value - b.value);
    if (!sorted.length) return 0;
    const total = sorted.reduce((sum, row) => sum + row.weight, 0);
    let seen = 0;
    for (const row of sorted) {
        seen += row.weight;
        if (seen >= total * fraction) return row.value;
    }
    return sorted[sorted.length - 1].value;
}

/**
 * Each channel uses its OWN evidence type. There is no universal discount
 * from retail to auction or unsupported assertion that public asking prices
 * are achieved prices. Sparse channels remain transparent provisional guides.
 */
export function calculateMarketChannelGuides(
    base: { low: number; mid: number; high: number },
    observations: ChannelObservation[],
): MarketChannelGuides {
    const valid = observations.filter((row) =>
        Number.isFinite(row.value) && row.value >= 250
        && Number.isFinite(row.weight) && row.weight > 0,
    );

    const advertised = valid.filter((row) => row.kind === 'ACTIVE_ASK');
    const privateCompleted = valid.filter((row) =>
        row.kind === 'SALE' && row.saleChannel === 'PRIVATE'
        && row.verifiedPrivateSale === true);
    const confirmedAuctions = valid.filter((row) =>
        row.kind === 'AUCTION_RESULT'
        && row.saleChannel === 'AUCTION'
        && row.verifiedAuctionSale === true);

    // The main base range already normalises advert asking prices
    // conservatively. For a sufficiently broad set of adverts, use the
    // distinct asking-price distribution directly instead of a fixed uplift.
    const hasAskingMarket = advertised.length >= 3;
    const q25Ask = hasAskingMarket
        ? weightedQuantile(advertised.map(({ channelValue, value, weight }) => ({ value: channelValue ?? value, weight })), 0.25)
        : base.mid;
    const q75Ask = hasAskingMarket
        ? weightedQuantile(advertised.map(({ channelValue, value, weight }) => ({ value: channelValue ?? value, weight })), 0.75)
        : base.high;
    const retailMinimum = hasAskingMarket
        ? roundChannelMoney(Math.min(q25Ask, q75Ask))
        : base.mid;
    const retailAsking = hasAskingMarket
        ? roundChannelMoney(Math.max(q25Ask, q75Ask))
        : base.high;

    const hasPrivateSales = privateCompleted.length >= 3;
    // The private proxy is bounded by the broad observed/fallback market
    // range, not an unsupported fixed fraction of advertised retail prices.
    const privateLow = hasPrivateSales
        ? roundChannelMoney(weightedQuantile(privateCompleted.map(({ channelValue, value, weight }) => ({ value: channelValue ?? value, weight })), 0.25))
        : base.low;
    const privateHigh = hasPrivateSales
        ? roundChannelMoney(weightedQuantile(privateCompleted.map(({ channelValue, value, weight }) => ({ value: channelValue ?? value, weight })), 0.75))
        : base.mid;
    const privateMid = hasPrivateSales
        ? roundChannelMoney(weightedQuantile(privateCompleted.map(({ channelValue, value, weight }) => ({ value: channelValue ?? value, weight })), 0.5))
        : roundChannelMoney((privateLow + privateHigh) / 2);

    const hasAuctionOutcomes = confirmedAuctions.length >= 3;
    // Price normalization supplies an unboosted, age/mileage-adjusted
    // channel price, so retail-equivalent auction uplift from the broad
    // market calculation never contaminates achieved auction evidence.
    const auctionObserved = confirmedAuctions.map(({ channelValue, value, weight }) =>
        ({ value: channelValue ?? value, weight }));
    const auctionLow = hasAuctionOutcomes
        ? roundChannelMoney(weightedQuantile(auctionObserved, 0.25))
        : base.low;
    const auctionMid = hasAuctionOutcomes
        ? roundChannelMoney(weightedQuantile(auctionObserved, 0.5))
        : base.low;
    const auctionHigh = hasAuctionOutcomes
        ? roundChannelMoney(weightedQuantile(auctionObserved, 0.75))
        : base.mid;

    // Spread-driven opening/reserve GUIDANCE replaces the universal
    // 70/90/95% multipliers. If no verified outcome cohort exists, it is
    // clearly flagged PROVISIONAL_PROXY and must not be an automatic reserve.
    const observedSpread = Math.max(100,
        hasAuctionOutcomes
            ? auctionMid - auctionLow
            : base.mid - base.low);
    const openingBid = roundChannelMoney(Math.max(500, auctionLow - observedSpread));
    const reserveLow = hasAuctionOutcomes
        ? auctionLow
        : roundChannelMoney(Math.max(500, auctionMid - observedSpread / 4));
    const reserveHigh = hasAuctionOutcomes
        ? Math.max(auctionHigh, reserveLow + 50)
        : roundChannelMoney(Math.max(reserveLow + 50, auctionMid + observedSpread / 4));
    const boundedOpening = Math.min(openingBid, Math.max(500, reserveLow - 50));

    return {
        retail: {
            suggestedAsking: Math.max(retailMinimum, retailAsking),
            suggestedMinimum: retailMinimum,
            evidenceBasis: hasAskingMarket ? 'OBSERVED' : 'PROVISIONAL_PROXY',
            observedAsks: advertised.length,
        },
        privateSale: {
            low: Math.min(privateLow, privateMid),
            mid: privateMid,
            high: Math.max(privateMid, privateHigh),
            evidenceBasis: hasPrivateSales ? 'OBSERVED' : 'PROVISIONAL_PROXY',
            verifiedSales: privateCompleted.length,
        },
        auction: {
            marketValue: auctionMid,
            openingBid: boundedOpening,
            reserveLow,
            reserveHigh,
            suggestedReserve: Math.max(reserveLow, Math.min(reserveHigh, auctionMid)),
            evidenceBasis: hasAuctionOutcomes ? 'OBSERVED' : 'PROVISIONAL_PROXY',
            verifiedOutcomes: confirmedAuctions.length,
        },
    };
}

export function scaleMarketChannelGuides(
    channels: MarketChannelGuides,
    factor: number,
): MarketChannelGuides {
    const scale = (value: number) => roundChannelMoney(value * factor);
    // Scale each independently derived channel guide rather than reverting
    // to fixed-percentage reserve/bid maths after a seller edits their spec.
    const marketValue = scale(channels.auction.marketValue);
    const reserveLow = scale(channels.auction.reserveLow);
    const reserveHigh = Math.max(scale(channels.auction.reserveHigh), reserveLow + 50);
    return {
        retail: {
            ...channels.retail,
            suggestedAsking: scale(channels.retail.suggestedAsking),
            suggestedMinimum: scale(channels.retail.suggestedMinimum),
        },
        privateSale: {
            ...channels.privateSale,
            low: scale(channels.privateSale.low),
            mid: scale(channels.privateSale.mid),
            high: scale(channels.privateSale.high),
        },
        auction: {
            ...channels.auction,
            marketValue,
            openingBid: Math.min(scale(channels.auction.openingBid), Math.max(500, reserveLow - 50)),
            reserveLow,
            reserveHigh,
            suggestedReserve: Math.max(reserveLow, Math.min(reserveHigh, scale(channels.auction.suggestedReserve))),
        },
    };
}
