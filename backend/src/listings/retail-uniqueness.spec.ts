import { hasOtherActiveRetailRegistration } from './retail-uniqueness';
describe('retail registration collision guard', () => {
    const car = { id: 'own', type: 'CLASSIFIED', vrm: 'AB12 CDE' };
    it('rejects a duplicate active retail registration even when plates use different spacing', async () => {
        const queryRaw = jest.fn().mockResolvedValue([{ id: 'another' }]);
        expect(await hasOtherActiveRetailRegistration({ $queryRaw: queryRaw } as any, car)).toBe(true);
        expect(queryRaw).toHaveBeenCalledTimes(1);
    });
    it('allows a vehicle with no active duplicate', async () => {
        expect(await hasOtherActiveRetailRegistration({ $queryRaw: jest.fn().mockResolvedValue([]) } as any, car)).toBe(false);
    });
    it('does not apply the retail guard to auctions or malformed registrations', async () => {
        const queryRaw = jest.fn();
        expect(await hasOtherActiveRetailRegistration({ $queryRaw: queryRaw } as any, {...car,type:'AUCTION'})).toBe(false);
        expect(await hasOtherActiveRetailRegistration({ $queryRaw: queryRaw } as any, {...car,vrm:'!'})).toBe(false);
        expect(queryRaw).not.toHaveBeenCalled();
    });
});
