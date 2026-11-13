import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FinanceRoutingService, validateFinanceApplicationUrl } from './finance-routing.service';
import { AdminFinanceRoutingController } from './admin-finance-routing.controller';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('Admin finance routing', () => {
    const partner = { id: 'partner', name: 'Partner', enabled: true, applicationUrl: 'https://finance.example.test/apply', disclosure: 'Provider disclosure', updatedAt: new Date('2026-11-13T00:00:00Z') };
    const setup = () => {
        const prisma: any = {
            financeListingRoute: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn(), deleteMany: jest.fn() },
            financeProvider: { findFirst: jest.fn().mockResolvedValue(partner), findUnique: jest.fn().mockResolvedValue(partner), updateMany: jest.fn(), update: jest.fn(), create: jest.fn() },
            listing: { findFirst: jest.fn().mockResolvedValue({ id: 'listing' }) },
        };
        prisma.$transaction = jest.fn(callback => callback(prisma));
        return { prisma, routing: new FinanceRoutingService(prisma) };
    };
    it('protects every admin action with authentication and the admin role', () => {
        expect(Reflect.getMetadata(ROLES_KEY, AdminFinanceRoutingController)).toEqual(['ADMIN']);
        expect(Reflect.getMetadata(GUARDS_METADATA, AdminFinanceRoutingController)).toEqual([SessionAuthGuard, RolesGuard]);
    });
    it('uses the default when no override exists', async () => {
        const { routing } = setup();
        expect(await routing.forListing('listing')).toMatchObject({ id: 'partner', applicationUrl: partner.applicationUrl });
    });
    it.each([null, { ...partner, enabled: false }])('does not fall back when an override is off or its provider is disabled', async provider => {
        const { prisma, routing } = setup(); prisma.financeListingRoute.findUnique.mockResolvedValue({ provider });
        expect(await routing.forListing('listing')).toBeNull();
        expect(prisma.financeProvider.findFirst).not.toHaveBeenCalled();
    });
    it('uses the specific provider rather than the default', async () => {
        const { prisma, routing } = setup(); prisma.financeListingRoute.findUnique.mockResolvedValue({ provider: { ...partner, id: 'specific' } });
        expect(await routing.forListing('listing')).toMatchObject({ id: 'specific' });
        expect(prisma.financeProvider.findFirst).not.toHaveBeenCalled();
    });
    it('changes the default atomically and records the acting admin', async () => {
        const { prisma, routing } = setup();
        await routing.save('admin', { name: 'Partner', applicationUrl: partner.applicationUrl, disclosure: partner.disclosure, enabled: true, isDefault: true }, 'partner');
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
        expect(prisma.financeProvider.updateMany).toHaveBeenCalledWith({ where: { isDefault: true }, data: { isDefault: false, updatedById: 'admin' } });
        expect(prisma.financeProvider.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isDefault: true, updatedById: 'admin' }) }));
    });
    it('rejects disabled defaults and disabled listing providers', async () => {
        const { prisma, routing } = setup();
        await expect(routing.save('admin', { ...partner, enabled: false, isDefault: true })).rejects.toBeInstanceOf(BadRequestException);
        prisma.financeProvider.findFirst.mockResolvedValue(null);
        await expect(routing.setListing('admin', 'listing', { mode: 'PROVIDER', providerId: 'disabled' })).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.financeListingRoute.upsert).not.toHaveBeenCalled();
    });
    it('distinguishes default inheritance from an explicit off override', async () => {
        const { prisma, routing } = setup();
        await routing.setListing('admin', 'listing', { mode: 'OFF' });
        expect(prisma.financeListingRoute.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { listingId: 'listing', providerId: null, updatedById: 'admin' } }));
        await routing.setListing('admin', 'listing', { mode: 'DEFAULT' });
        expect(prisma.financeListingRoute.deleteMany).toHaveBeenCalledWith({ where: { listingId: 'listing' } });
    });
    it.each(['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com/', 'https://localhost/', 'https://127.0.0.1', 'https://10.1.2.3', 'https://[::1]/', 'https://example.com/#data', 'not a URL'])('rejects unsafe application targets: %s', url => {
        expect(() => validateFinanceApplicationUrl(url)).toThrow(BadRequestException);
    });
});
