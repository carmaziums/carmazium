import { buildListingActivationData } from './listing-activation';

describe('buildListingActivationData', () => {
    it('does not feature Basic or Standard listings automatically', () => {
        for (const tier of ['BASIC', 'STANDARD']) {
            const data = buildListingActivationData(tier);
            expect(data.status).toBe('ACTIVE');
            expect(data.isFeatured).toBe(false);
            expect(data.featuredUntil).toBeNull();
        }
    });

    it('gives Premium the included 28-day Featured Boost from go-live', () => {
        const before = Date.now();
        const data = buildListingActivationData('PREMIUM');
        const after = Date.now();

        expect(data.status).toBe('ACTIVE');
        expect(data.isFeatured).toBe(true);
        expect(data.featuredUntil).toBeInstanceOf(Date);

        const duration = data.featuredUntil!.getTime() - before;
        const maxDuration = data.featuredUntil!.getTime() - after;
        const twentyEightDays = 28 * 24 * 60 * 60 * 1000;

        expect(duration).toBeGreaterThanOrEqual(twentyEightDays);
        expect(maxDuration).toBeLessThanOrEqual(twentyEightDays);
    });
});
