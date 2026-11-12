import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WarrantyAvailabilityDto } from './service-leads.dto';
import { ServiceLeadsService } from './service-leads.service';

describe('Retail warranty enquiries', () => {
    const listingId = '09a2b9bd-187e-4c34-90b1-b0a411f8bdc9';
    const listing = {
        id: listingId, title: 'Toyota Yaris', slug: 'toyota-yaris', price: '4495.00',
        type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null, vehicle: null,
        vrm: 'AB12CDE', make: 'Toyota', model: 'Yaris', year: 2018, mileage: 45000,
        sellerId: 'seller', offers: [],
    };
    const provider = {
        contractorId: 'warranty-provider', leadNationwide: false, leadPostcodeAreas: ['B'],
        leadMinVehicleYear: 2015, leadMaxVehicleMileage: 100000,
        leadMinVehicleValuePence: 100000, leadMaxVehicleValuePence: 1000000,
        leadWarrantyLevels: ['Comprehensive'], leadWarrantyMinMonths: 6, leadWarrantyMaxMonths: 24,
        contractor: { userId: 'provider-user', rating: 0, totalReviews: 0 },
    };
    let prisma: any;
    let service: ServiceLeadsService;
    let notifications: any;
    const criteria = { listingId, postcode: 'b19 1es', warrantyMonths: 12, warrantyLevel: 'Comprehensive' };

    beforeEach(() => {
        prisma = {
            listing: {
                findFirst: jest.fn().mockResolvedValue(listing),
                findUnique: jest.fn().mockResolvedValue(listing),
            },
            user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Test', lastName: 'Buyer', email: 'buyer@example.test' }) },
            contractorCapability: { findMany: jest.fn().mockResolvedValue([provider]) },
            serviceLead: {
                count: jest.fn().mockResolvedValue(0),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-lead', ...data, _count: { recipients: data.recipients.create.length } })),
            },
        };
        prisma.$transaction = jest.fn(work => work(prisma));
        notifications = { create: jest.fn().mockResolvedValue({}) };
        service = new ServiceLeadsService(prisma, notifications);
    });

    it('checks public availability without reading an account, saving a lead or disclosing provider identities', async () => {
        expect(await service.warrantyAvailability(criteria)).toEqual({ available: true, providerCount: 1 });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.serviceLead.create).not.toHaveBeenCalled();
        expect(notifications.create).not.toHaveBeenCalled();
        expect(prisma.contractorCapability.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ serviceType: 'WARRANTY', status: 'APPROVED', verificationStatus: 'VERIFIED', verificationExpiresAt: { gt: expect.any(Date) } }),
        }));
    });

    it('prefills the real retail vehicle and price without exposing seller or account data', async () => {
        expect(await service.warrantyListing(listingId)).toEqual({
            id: listingId, title: 'Toyota Yaris', slug: 'toyota-yaris', vehicleRegistration: 'AB12CDE',
            vehicleMake: 'Toyota', vehicleModel: 'Yaris', vehicleYear: 2018, vehicleMileage: 45000, vehicleValuePence: 449500,
        });
        expect(prisma.listing.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
            id: listingId, type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null,
        } }));
    });

    it('rejects unavailable retail listings instead of falling back to user-supplied details', async () => {
        prisma.listing.findFirst.mockResolvedValue(null);
        await expect(service.warrantyAvailability(criteria)).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.create('buyer', { ...criteria, serviceType: ServiceType.WARRANTY, requireMatchedProvider: true, consentToProviderContact: true })).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.serviceLead.create).not.toHaveBeenCalled();
    });

    it.each([
        { postcode: 'SW1A 1AA' }, { warrantyMonths: 36 }, { warrantyLevel: 'Premium' },
    ])('reports no matches for ineligible coverage: %j', async (overrides) => {
        expect(await service.warrantyAvailability({ ...criteria, ...overrides })).toEqual({ available: false, providerCount: 0 });
    });

    it('does not interpret Not sure as an unavailable warranty product', async () => {
        expect(await service.warrantyAvailability({ ...criteria, warrantyLevel: 'Not sure' })).toEqual({ available: true, providerCount: 1 });
    });

    it('uses listing facts rather than altered URL/form criteria to determine eligibility', async () => {
        prisma.contractorCapability.findMany.mockResolvedValue([{ ...provider, leadMaxVehicleMileage: 10000 }]);
        expect(await service.warrantyAvailability({ ...criteria, vehicleMileage: 5000 })).toEqual({ available: false, providerCount: 0 });
    });

    it('requires a real UK postcode and validates numeric query fields', async () => {
        await expect(service.warrantyAvailability({ ...criteria, postcode: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
        const dto = plainToInstance(WarrantyAvailabilityDto, { ...criteria, warrantyMonths: '12', vehicleMileage: '45000' });
        expect(await validate(dto)).toEqual([]);
        expect(dto.warrantyMonths).toBe(12);
        expect((await validate(plainToInstance(WarrantyAvailabilityDto, { ...criteria, warrantyMonths: '-1' }))).length).toBeGreaterThan(0);
    });

    it('rechecks providers on submission and saves nothing if the last provider became unavailable', async () => {
        await service.warrantyAvailability(criteria);
        prisma.contractorCapability.findMany.mockResolvedValue([]);
        await expect(service.create('buyer', { ...criteria, serviceType: ServiceType.WARRANTY, requireMatchedProvider: true, consentToProviderContact: true })).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.serviceLead.create).not.toHaveBeenCalled();
        expect(notifications.create).not.toHaveBeenCalled();
    });

    it('saves a consented listing-linked enquiry to the matched provider inbox and notifies that provider', async () => {
        await service.create('buyer', { ...criteria, serviceType: ServiceType.WARRANTY, vehicleValuePence: 1, requireMatchedProvider: true, consentToProviderContact: true });
        expect(prisma.serviceLead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
            listingId, vehicleRegistration: 'AB12CDE', vehicleValuePence: 449500,
            email: 'buyer@example.test', consentToProviderContact: true,
            recipients: { create: [expect.objectContaining({ contractorId: 'warranty-provider', status: 'NEW' })] },
        }) }));
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'provider-user', type: 'SERVICE_LEAD_NEW' }));
    });

    it('never sends the enquiry without contact-sharing consent', async () => {
        await expect(service.create('buyer', { ...criteria, serviceType: ServiceType.WARRANTY, requireMatchedProvider: true, consentToProviderContact: false })).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.serviceLead.create).not.toHaveBeenCalled();
    });
});
