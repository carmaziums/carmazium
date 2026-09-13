import {
    isFreeListingGrantActive,
    readFreeListingGrant,
    type FreeListingGrant,
} from './free-listing-entitlement.service';

describe('free listing entitlement helpers', () => {
    const now = new Date('2026-09-13T12:00:00.000Z');

    it('returns null when no grant is stored', () => {
        expect(readFreeListingGrant(null)).toBeNull();
        expect(readFreeListingGrant({ theme: 'dark' })).toBeNull();
    });

    it('treats a one-listing grant as active', () => {
        const grant = readFreeListingGrant({
            freeListingGrant: {
                mode: 'ONE',
                grantedAt: '2026-09-13T10:00:00.000Z',
                grantedBy: 'admin-1',
            },
        });
        expect(grant?.mode).toBe('ONE');
        expect(isFreeListingGrantActive(grant, now)).toBe(true);
    });

    it('treats an unexpired timed grant as active', () => {
        const grant: FreeListingGrant = {
            mode: 'UNTIL',
            expiresAt: '2026-09-14T12:00:00.000Z',
            grantedAt: '2026-09-13T10:00:00.000Z',
            grantedBy: 'admin-1',
        };
        expect(isFreeListingGrantActive(grant, now)).toBe(true);
    });

    it('treats an expired timed grant as inactive', () => {
        const grant: FreeListingGrant = {
            mode: 'UNTIL',
            expiresAt: '2026-09-13T11:59:59.000Z',
            grantedAt: '2026-09-12T10:00:00.000Z',
            grantedBy: 'admin-1',
        };
        expect(isFreeListingGrantActive(grant, now)).toBe(false);
    });

    it('treats free-forever as active', () => {
        const grant: FreeListingGrant = {
            mode: 'FOREVER',
            grantedAt: '2026-09-01T10:00:00.000Z',
            grantedBy: 'admin-1',
        };
        expect(isFreeListingGrantActive(grant, now)).toBe(true);
    });

    it('rejects malformed timed grants without an expiry', () => {
        expect(readFreeListingGrant({
            freeListingGrant: {
                mode: 'UNTIL',
                grantedAt: '2026-09-13T10:00:00.000Z',
                grantedBy: 'admin-1',
            },
        })).toBeNull();
    });
});
