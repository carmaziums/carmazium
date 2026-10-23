import { initialOnly, redactBidderIdentity, redactBidListIdentities } from './bidder-privacy';
describe('bidder identity exposure', () => {
    it('returns one uppercase initial or null', () => {
        expect(initialOnly(' jonathan ')).toBe('J');
        expect(initialOnly('smith')).toBe('S');
        expect(initialOnly('')).toBeNull();
        expect(initialOnly(null)).toBeNull();
    });
    it('allows only bidder id and initials even when future includes add private fields', () => {
        expect(redactBidderIdentity({
            id: 'user1', firstName: 'Jonathan', lastName: 'Smith',
            email: 'private@example.invalid', phone: '0123456789',
        })).toEqual({ id: 'user1', firstName: 'J', lastName: 'S' });
    });
    it('does not mutate original Prisma rows', () => {
        const source = [{ id: 'b1', bidder: { id: 'd1', firstName: 'Alice', lastName: 'Jones' } }];
        const result = redactBidListIdentities(source);
        expect(result[0].bidder).toEqual({ id: 'd1', firstName: 'A', lastName: 'J' });
        expect(source[0].bidder.firstName).toBe('Alice');
    });
    it('handles missing lists and null bidders', () => {
        expect(redactBidListIdentities(undefined)).toEqual([]);
        expect(redactBidListIdentities([{ bidder: null }])).toEqual([{ bidder: null }]);
    });
});
