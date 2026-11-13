import { AdminServicesController } from './admin-services.controller';
import { ServicesLifecycleService } from './services-lifecycle.service';
import { ForbiddenException } from '@nestjs/common';
import { ServiceLeadsController } from './service-leads.controller';
import { ServiceLeadsService } from './service-leads.service';
import { WarrantyEnquiriesController } from './warranty-enquiries.controller';

describe('Admin-managed finance and warranty applications', () => {
    it('rejects retired provider inbox, direct detail and response routes before accessing records', async () => {
        const service = { create: jest.fn(), inboxPage: jest.fn(), providerLead: jest.fn(), respond: jest.fn() };
        const controller = new ServiceLeadsController(service as any);
        await expect(controller.create({ id: 'customer' }, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(controller.inbox({ id: 'pulse-cars-owner' }, { serviceType: 'WARRANTY' } as any)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(controller.providerLead({ id: 'provider' }, 'known-lead')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(controller.respond({ id: 'provider' }, 'known-lead', {} as any)).rejects.toBeInstanceOf(ForbiddenException);
        expect(service.inboxPage).not.toHaveBeenCalled();
        expect(service.providerLead).not.toHaveBeenCalled();
        expect(service.respond).not.toHaveBeenCalled();
        expect(service.create).not.toHaveBeenCalled();
    });

    it('keeps the retired matching flow unavailable until the new warranty product is ready', async () => {
        const leads = { warrantyAvailability: jest.fn() };
        const controller = new WarrantyEnquiriesController(leads as any);
        expect(await controller.availability({} as any)).toMatchObject({ data: { available: false, providerCount: 0 } });
        expect(leads.warrantyAvailability).not.toHaveBeenCalled();
    });

    it('blocks legacy admin rematching and stops hourly enquiry broadcasts', async () => {
        const leads = { adminRematch: jest.fn(), rematchOpenLeads: jest.fn(), expireOldLeads: jest.fn().mockResolvedValue(0) };
        const controller = new AdminServicesController({} as any, leads as any);
        await expect(controller.rematchLead('historical-enquiry')).rejects.toBeInstanceOf(ForbiddenException);
        expect(leads.adminRematch).not.toHaveBeenCalled();
        const jobs = { expireOpenJobs: jest.fn().mockResolvedValue(0), autoConfirmCompleted: jest.fn().mockResolvedValue(0) };
        const lifecycle = new ServicesLifecycleService(jobs as any, {} as any, {} as any, {} as any, leads as any);
        jest.spyOn(lifecycle, 'expireUnpaidAcceptedJobs').mockResolvedValue(0);
        jest.spyOn(lifecycle, 'maintainCapabilityVerification').mockResolvedValue({ expired: 0, reminded: 0 });
        await lifecycle.tick();
        expect(leads.expireOldLeads).toHaveBeenCalled();
        expect(leads.rematchOpenLeads).not.toHaveBeenCalled();
    });

    it('lets admin appoint a partner without granting approval or overwriting existing verification', async () => {
        const prisma: any = {
            user: { findFirst: jest.fn().mockResolvedValue({ id: 'partner-owner' }) },
            contractorProfile: { upsert: jest.fn().mockResolvedValue({ id: 'partner-profile', deletedAt: null }) },
            contractorCapability: { upsert: jest.fn().mockResolvedValue({ id: 'capability', status: 'PENDING' }) },
        };
        prisma.$transaction = jest.fn(fn => fn(prisma));
        const service = new ServiceLeadsService(prisma, {} as any);
        await service.adminCreateWarrantyPartner('admin', { email: 'partner@example.test', businessName: 'Warranty Partner' });
        expect(prisma.contractorCapability.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ serviceType: 'WARRANTY', status: 'PENDING', reviewedById: 'admin' }),
            update: {},
        }));
        expect(prisma.contractorProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    });
});
