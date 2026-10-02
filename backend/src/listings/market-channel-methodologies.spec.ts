import {
    calculateMarketChannelGuides,
    scaleMarketChannelGuides,
    type ChannelObservation,
} from './market-channel-methodologies';

const base = { low: 8000, mid: 10_000, high: 12_000 };
const observed = (value: number, kind: ChannelObservation['kind'], extra: Partial<ChannelObservation> = {}): ChannelObservation => ({
    value, channelValue: value, weight: 1, kind, ...extra,
});

describe('Block 6: separate channel valuation methodologies', () => {
    it('does not invent achieved private or auction evidence from five public retail adverts', () => {
        const asks = [9000, 9500, 10_000, 10_500, 11_000]
            .map((price) => observed(price, 'ACTIVE_ASK'));
        const guide = calculateMarketChannelGuides(base, asks);
        expect(guide.retail).toEqual({
            suggestedAsking: 10_500,
            suggestedMinimum: 9500,
            evidenceBasis: 'OBSERVED',
            observedAsks: 5,
        });
        expect(guide.privateSale).toMatchObject({
            evidenceBasis: 'PROVISIONAL_PROXY', verifiedSales: 0,
        });
        expect(guide.auction).toMatchObject({
            evidenceBasis: 'PROVISIONAL_PROXY', verifiedOutcomes: 0,
        });
        expect(guide.auction.openingBid).toBeLessThan(guide.auction.reserveLow);
        expect(guide.auction.reserveLow).toBeLessThan(guide.auction.reserveHigh);
    });

    it('uses its own verified completed auction distribution rather than 70/90/95% of retail', () => {
        const proof = { saleChannel: 'AUCTION' as const, verifiedAuctionSale: true };
        const rows = [
            observed(5900, 'AUCTION_RESULT', proof),
            observed(6250, 'AUCTION_RESULT', proof),
            observed(6700, 'AUCTION_RESULT', proof),
            observed(7200, 'AUCTION_RESULT', proof),
        ];
        const guide = calculateMarketChannelGuides(base, rows);
        expect(guide.auction).toEqual({
            evidenceBasis: 'OBSERVED',
            verifiedOutcomes: 4,
            marketValue: 6250,
            openingBid: 5550,
            reserveLow: 5900,
            reserveHigh: 6700,
            suggestedReserve: 6250,
        });
        expect(guide.retail.evidenceBasis).toBe('PROVISIONAL_PROXY');
        expect(guide.privateSale.evidenceBasis).toBe('PROVISIONAL_PROXY');
    });

    it('does not promote pending winning bids or incomplete seller handovers to achieved prices', () => {
        const rows = [
            observed(2000, 'AUCTION_RESULT', { saleChannel: 'AUCTION' }),
            observed(2200, 'AUCTION_RESULT', { saleChannel: 'AUCTION', verifiedAuctionSale: false }),
            observed(2800, 'AUCTION_RESULT'),
            observed(3000, 'ACTIVE_ASK'),
        ];
        const guide = calculateMarketChannelGuides(base, rows);
        expect(guide.auction.evidenceBasis).toBe('PROVISIONAL_PROXY');
        expect(guide.auction.verifiedOutcomes).toBe(0);
        expect(guide.auction.marketValue).toBe(base.low);
    });

    it('uses explicitly verified private-party completed sales only when there are enough', () => {
        const rows = [
            observed(8200, 'SALE', { saleChannel: 'PRIVATE', verifiedPrivateSale: true }),
            observed(8750, 'SALE', { saleChannel: 'PRIVATE', verifiedPrivateSale: true }),
            observed(9100, 'SALE', { saleChannel: 'PRIVATE', verifiedPrivateSale: true }),
            observed(9300, 'SALE', { saleChannel: 'RETAIL' }),
            observed(7200, 'SALE', { saleChannel: 'PRIVATE', verifiedPrivateSale: false }),
        ];
        const guide = calculateMarketChannelGuides(base, rows);
        expect(guide.privateSale).toEqual({
            low: 8200, mid: 8750, high: 9100,
            evidenceBasis: 'OBSERVED', verifiedSales: 3,
        });
        expect(guide.auction.evidenceBasis).toBe('PROVISIONAL_PROXY');
    });

    it('uses provisional range geometry, not unsupported universal price ratios, for sparse channels', () => {
        const guide = calculateMarketChannelGuides(base, []);
        expect(guide.retail).toMatchObject({
            evidenceBasis: 'PROVISIONAL_PROXY', suggestedAsking: 12_000,
            suggestedMinimum: 10_000, observedAsks: 0,
        });
        expect(guide.privateSale).toMatchObject({
            low: 8000, mid: 9000, high: 10_000, verifiedSales: 0,
        });
        expect(guide.auction).toMatchObject({
            marketValue: 8000, openingBid: 6000,
            reserveLow: 7500, reserveHigh: 8500,
            suggestedReserve: 8000, verifiedOutcomes: 0,
        });
        expect(guide.auction.openingBid).not.toBe(Math.round(base.low * 0.70));
    });

    it('scales independent channel guides and keeps source labels/counts on seller changes', () => {
        const guide = calculateMarketChannelGuides(base,
            [5900, 6250, 6700].map((value) => observed(value, 'AUCTION_RESULT', {
                saleChannel: 'AUCTION', verifiedAuctionSale: true,
            })));
        const amended = scaleMarketChannelGuides(guide, 1.10);
        expect(amended.auction.evidenceBasis).toBe('OBSERVED');
        expect(amended.auction.verifiedOutcomes).toBe(3);
        expect(amended.auction.marketValue).toBeGreaterThan(guide.auction.marketValue);
        expect(amended.auction.openingBid).toBeLessThan(amended.auction.reserveLow);
        expect(amended.auction.reserveLow).toBeLessThan(amended.auction.reserveHigh);
        expect(amended.privateSale.evidenceBasis).toBe('PROVISIONAL_PROXY');
    });
});
