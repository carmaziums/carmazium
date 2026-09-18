import { hasExpectedImageSignature } from './chat-attachment.service';

describe('chat attachment image signatures', () => {
    it('accepts JPEG, PNG and WebP magic bytes', () => {
        expect(hasExpectedImageSignature(
            new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
            'image/jpeg',
        )).toBe(true);

        expect(hasExpectedImageSignature(
            new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            'image/png',
        )).toBe(true);

        expect(hasExpectedImageSignature(
            new Uint8Array([
                0x52, 0x49, 0x46, 0x46,
                0x00, 0x00, 0x00, 0x00,
                0x57, 0x45, 0x42, 0x50,
            ]),
            'image/webp',
        )).toBe(true);
    });

    it('rejects spoofed content for every allowed image MIME', () => {
        const fake = new Uint8Array([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3e]);
        expect(hasExpectedImageSignature(fake, 'image/jpeg')).toBe(false);
        expect(hasExpectedImageSignature(fake, 'image/png')).toBe(false);
        expect(hasExpectedImageSignature(fake, 'image/webp')).toBe(false);
    });
});
