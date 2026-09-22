/**
 * Security properties of dealer KYC document storage.
 *
 * These documents — passports, driving licences, proof of address — were
 * uploaded by the browser into the PUBLIC `listings` bucket and stored as
 * permanent public URLs. The tests below pin the properties that stop that
 * happening again: private bucket only, server-chosen object keys, content
 * that matches its declared type, and links that expire.
 */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycDocumentsService, DEALER_KYC_BUCKET } from './kyc-documents.service';

const upload = jest.fn();
const createSignedUrl = jest.fn();
const from = jest.fn(() => ({ upload, createSignedUrl }));

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({ storage: { from } })),
}));

const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
]);

const file = (over: Record<string, any> = {}) => ({
    originalname: 'passport.png',
    mimetype: 'image/png',
    size: PNG.length,
    buffer: PNG,
    ...over,
});

describe('dealer KYC private document storage', () => {
    let service: KycDocumentsService;
    let prisma: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_KEY = 'service-role-key';
        upload.mockResolvedValue({ error: null });
        createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/doc?token=abc' }, error: null });

        prisma = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'dealer-1' }) },
            dealerKyc: {
                findUnique: jest.fn().mockResolvedValue({ id: 'kyc-1' }),
                update: jest.fn().mockResolvedValue({}),
            },
        };

        const mod = await Test.createTestingModule({
            providers: [KycDocumentsService, { provide: PrismaService, useValue: prisma }],
        }).compile();
        service = mod.get(KycDocumentsService);
    });

    it('writes only to the private bucket, never the public listings bucket', async () => {
        await service.storeDocument('user-1', 'directorIdProof', file());
        expect(from).toHaveBeenCalledWith(DEALER_KYC_BUCKET);
        expect(from).not.toHaveBeenCalledWith('listings');
    });

    it('generates the object key server-side, scoped to the dealer', async () => {
        const key = await service.storeDocument('user-1', 'directorIdProof', file());
        expect(key).toMatch(/^dealer-1\/directorIdProof\/[0-9a-f-]{36}\.png$/);
        // and never overwrites an existing object
        expect(upload).toHaveBeenCalledWith(key, expect.anything(), expect.objectContaining({ upsert: false }));
    });

    it('records the private key on the KYC row, not a URL', async () => {
        const key = await service.storeDocument('user-1', 'proofOfAddress', file());
        expect(prisma.dealerKyc.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { proofOfAddressPath: key } }),
        );
    });

    it('rejects a file whose bytes do not match its declared type', async () => {
        const spoofed = file({ buffer: Buffer.from('<html>not a png</html>'), size: 22 });
        await expect(service.storeDocument('user-1', 'vatProof', spoofed))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(upload).not.toHaveBeenCalled();
    });

    it('rejects a disallowed file type', async () => {
        const exe = file({ originalname: 'x.exe', mimetype: 'application/x-msdownload' });
        await expect(service.storeDocument('user-1', 'vatProof', exe))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(upload).not.toHaveBeenCalled();
    });

    it('rejects an oversized document', async () => {
        const big = file({ size: 11 * 1024 * 1024, buffer: Buffer.alloc(11 * 1024 * 1024) });
        await expect(service.storeDocument('user-1', 'vatProof', big))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(upload).not.toHaveBeenCalled();
    });

    it('issues an expiring signed URL, not a permanent one', async () => {
        await service.signPath('dealer-1/vatProof/abc.png');
        const [, ttl] = createSignedUrl.mock.calls[0];
        expect(ttl).toBe(600);
    });

    it('hydrates a private key into a signed URL and hides the storage path', async () => {
        const out: any = await service.hydrateDocuments({
            id: 'kyc-1',
            directorIdProof: null,
            directorIdProofPath: 'dealer-1/directorIdProof/abc.png',
        } as any);
        expect(out.directorIdProof).toBe('https://signed.example/doc?token=abc');
        expect(out.directorIdProofIsPrivate).toBe(true);
        // the internal key must not leak to the client
        expect(out.directorIdProofPath).toBeUndefined();
    });

    it('falls back to the legacy public URL for records predating private storage', async () => {
        const legacy = 'https://xyz.supabase.co/storage/v1/object/public/listings/kyc/old.png';
        const out: any = await service.hydrateDocuments({
            id: 'kyc-old',
            vatProof: legacy,
            vatProofPath: null,
        } as any);
        expect(out.vatProof).toBe(legacy);
        expect(out.vatProofIsPrivate).toBe(false);
    });
});
