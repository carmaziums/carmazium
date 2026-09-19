import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    ServiceOperationsService,
    TRADEXCHANGE_DOCUMENT_BUCKET,
    hasExpectedTradeXchangeDocumentSignature,
} from './service-operations.service';

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

    const pdf = {
        originalname: 'insurance.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7 secure test'),
        get size() { return this.buffer.length; },
    };

    it('does not let one provider upload to another provider application', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            contractor: { userId: 'owner-1' },
        });

        await expect(
            service.uploadProviderCapabilityDocument('other-user', 'cap-1', pdf, 'Insurance'),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('recognises the allowed PDF and image signatures', () => {
        expect(hasExpectedTradeXchangeDocumentSignature(
            new Uint8Array(Buffer.from('%PDF-')),
            'application/pdf',
        )).toBe(true);
        expect(hasExpectedTradeXchangeDocumentSignature(
            new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
            'image/jpeg',
        )).toBe(true);
        expect(hasExpectedTradeXchangeDocumentSignature(
            new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            'image/png',
        )).toBe(true);
        expect(hasExpectedTradeXchangeDocumentSignature(
            new Uint8Array([
                0x52, 0x49, 0x46, 0x46,
                0x00, 0x00, 0x00, 0x00,
                0x57, 0x45, 0x42, 0x50,
            ]),
            'image/webp',
        )).toBe(true);
    });

    it('rejects spoofed file content', () => {
        const fake = new Uint8Array(Buffer.from('<script>alert(1)</script>'));
        expect(hasExpectedTradeXchangeDocumentSignature(fake, 'application/pdf')).toBe(false);
        expect(hasExpectedTradeXchangeDocumentSignature(fake, 'image/jpeg')).toBe(false);
        expect(hasExpectedTradeXchangeDocumentSignature(fake, 'image/png')).toBe(false);
        expect(hasExpectedTradeXchangeDocumentSignature(fake, 'image/webp')).toBe(false);
    });

    it('uploads an owning provider document only to the private bucket and returns a signed URL', async () => {
        prisma.contractorCapability.findUnique.mockResolvedValue({
            id: 'cap-1',
            contractor: { userId: 'owner-1' },
        });
        prisma.$queryRaw
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'entry-1',
                scope: 'CAPABILITY',
                kind: 'DOCUMENT',
                storagePath: 'capabilities/cap-1/owner-1/file.pdf',
            }]);

        const upload = jest.fn().mockResolvedValue({ error: null });
        const createSignedUrl = jest.fn().mockResolvedValue({
            data: { signedUrl: 'https://signed.example/private-file' },
            error: null,
        });
        const remove = jest.fn().mockResolvedValue({ error: null });
        const from = jest.fn().mockReturnValue({ upload, createSignedUrl, remove });
        (service as any).supabase = { storage: { from } };

        const result = await service.uploadProviderCapabilityDocument(
            'owner-1',
            'cap-1',
            pdf,
            'Goods in transit insurance',
        );

        expect(from).toHaveBeenCalledWith(TRADEXCHANGE_DOCUMENT_BUCKET);
        expect(upload).toHaveBeenCalledWith(
            expect.stringMatching(/^capabilities\/cap-1\/owner-1\/.+\.pdf$/),
            pdf.buffer,
            expect.objectContaining({ contentType: 'application/pdf', upsert: false }),
        );
        expect(result.url).toBe('https://signed.example/private-file');
    });

    it('rejects any client-supplied external attachment URL', async () => {
        prisma.serviceJob.findUnique.mockResolvedValue({ id: 'job-1', status: 'DISPUTED' });

        await expect(service.adminAddDisputeEntry('admin-1', 'job-1', {
            kind: 'DOCUMENT',
            url: 'https://example.com/insurance.pdf',
        } as any)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns an admin job with its case history without exposing storage paths', async () => {
        prisma.serviceJob.findUnique.mockResolvedValue({ id: 'job-1', status: 'DISPUTED', title: 'Vehicle move' });
        prisma.$queryRaw.mockResolvedValueOnce([{
            id: 'entry-1',
            scope: 'DISPUTE',
            note: 'Photos reviewed',
            storagePath: null,
        }]);

        const result = await service.adminJobDetail('job-1');

        expect(result.id).toBe('job-1');
        expect(result.caseEntries).toHaveLength(1);
        expect(result.caseEntries[0].storagePath).toBeUndefined();
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
