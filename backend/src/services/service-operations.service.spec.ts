import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ServiceOperationsService } from './service-operations.service';

describe('ServiceOperationsService', () => {
    let prisma: any;
    let services: any;
    let service: ServiceOperationsService;

    beforeEach(() => {
        prisma = {
            contractorCapability: { findUnique: jest.fn() },
            serviceJob: { findUnique: jest.fn() },
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn().mockResolvedValue(0),
        };
        services = { adminResolveDispute: jest.fn().mockResolvedValue({ ok: true }) };
        service = new ServiceOperationsService(prisma, services);
    });

    it('does not let one provider attach documents to another provider application', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            contractor: { userId: 'owner-1' },
        });

        await expect(service.addProviderCapabilityEntry('other-user', 'cap-1', {
            kind: 'DOCUMENT',
            label: 'Insurance',
            url: 'https://example.com/insurance.pdf',
        })).rejects.toBeInstanceOf(ForbiddenException);

        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('stores an HTTPS verification document for the owning provider', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            contractor: { userId: 'owner-1' },
        });
        prisma.$queryRaw
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'entry-1', scope: 'CAPABILITY', kind: 'DOCUMENT' }]);

        const result = await service.addProviderCapabilityEntry('owner-1', 'cap-1', {
            kind: 'DOCUMENT',
            label: 'Goods in transit insurance',
            url: 'https://example.com/insurance.pdf',
        });

        expect(result.id).toBe('entry-1');
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('rejects insecure attachment URLs', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            contractor: { userId: 'owner-1' },
        });
        prisma.$queryRaw.mockResolvedValueOnce([]);

        await expect(service.addProviderCapabilityEntry('owner-1', 'cap-1', {
            kind: 'DOCUMENT',
            url: 'http://example.com/file.pdf',
        })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns an admin job with its case history', async () => {
        prisma.serviceJob.findUnique.mockResolvedValue({ id: 'job-1', status: 'DISPUTED', title: 'Vehicle move' });
        prisma.$queryRaw.mockResolvedValueOnce([{ id: 'entry-1', scope: 'DISPUTE', note: 'Photos reviewed' }]);

        const result = await service.adminJobDetail('job-1');

        expect(result.id).toBe('job-1');
        expect(result.caseEntries).toHaveLength(1);
    });

    it('records the admin resolution after the existing safe dispute resolver succeeds', async () => {
        prisma.$queryRaw.mockResolvedValueOnce([{ id: 'resolution-1', kind: 'RESOLUTION' }]);

        await service.adminResolveDispute('admin-1', 'job-1', {
            outcome: 'REFUND',
            note: 'Damage evidence supports the customer.',
        });

        expect(services.adminResolveDispute).toHaveBeenCalledWith('admin-1', 'job-1', {
            outcome: 'REFUND',
            note: 'Damage evidence supports the customer.',
        });
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns Finance/Warranty recipient detail and normalises representative APR', async () => {
        prisma.$queryRaw
            .mockResolvedValueOnce([{ id: 'lead-1', serviceType: 'FINANCE', status: 'OPEN' }])
            .mockResolvedValueOnce([
                { id: 'recipient-1', status: 'RESPONDED', representativeApr: '7.9', businessName: 'Finance Co' },
                { id: 'recipient-2', status: 'VIEWED', representativeApr: null, businessName: 'Other Co' },
            ]);

        const result = await service.adminLeadDetail('lead-1');

        expect(result.recipientCount).toBe(2);
        expect(result.responseCount).toBe(1);
        expect(result.recipients[0].representativeApr).toBe(7.9);
    });
});
