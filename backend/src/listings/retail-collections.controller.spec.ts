import { RetailCollectionsController, collectionSlug } from './retail-collections.controller';
describe('public retail collections', () => {
    it('counts alias makes and advertised locations using active car stock only', async () => {
        const prisma = { listing: { groupBy: jest.fn().mockResolvedValue([
            { make: 'MERCEDES', location: 'Birmingham, UK', _count: { _all: 2 } },
            { make: 'Mercedes Benz', location: 'Walsall', _count: { _all: 3 } },
            { make: 'FORD', location: null, _count: { _all: 4 } },
        ]) } };
        const { data } = await new RetailCollectionsController(prisma as any).collections();
        expect(data.makes.find(x => x.slug === 'mercedes-benz')?.count).toBe(5);
        expect(data.locations.find(x => x.slug === 'birmingham')?.count).toBe(2);
        expect(data.locations.find(x => x.slug === 'london')?.count).toBe(0);
        expect(prisma.listing.groupBy.mock.calls[0][0].where).toMatchObject({ status: 'ACTIVE', type: 'CLASSIFIED', deletedAt: null, vehicleType: 'CAR' });
        expect(collectionSlug('Škoda')).toBe('skoda'); expect(collectionSlug('Citroën')).toBe('citroen');
    });
});
