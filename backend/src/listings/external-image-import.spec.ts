import {
    assertSafeImportImageUrl,
    detectImageType,
    isAllowedImportImageHost,
    isBlockedNetworkAddress,
} from './external-image-import';

describe('external image import security', () => {
    describe('marketplace host allowlist', () => {
        it('allows known AutoTrader, CarGurus and CarWow image hosts', () => {
            expect(isAllowedImportImageHost('m.atcdn.co.uk', 'AUTOTRADER')).toBe(true);
            expect(isAllowedImportImageHost('static.cargurus.com', 'CARGURUS')).toBe(true);
            expect(isAllowedImportImageHost('carwow-uk-0.imgix.net', 'CARWOW')).toBe(true);
            expect(isAllowedImportImageHost('carwow-uk-wp-3.imgix.net', 'CARWOW')).toBe(true);
        });

        it('rejects unrelated hosts even when they contain a marketplace name', () => {
            expect(isAllowedImportImageHost('autotrader.co.uk.attacker.example', 'AUTOTRADER')).toBe(false);
            expect(isAllowedImportImageHost('cargurus.com.attacker.example', 'CARGURUS')).toBe(false);
            expect(isAllowedImportImageHost('carwow.co.uk.attacker.example', 'CARWOW')).toBe(false);
        });
    });

    describe('URL boundary', () => {
        it('requires HTTPS and rejects embedded credentials', () => {
            expect(() => assertSafeImportImageUrl('http://m.atcdn.co.uk/car.jpg', 'AUTOTRADER')).toThrow('HTTPS');
            expect(() => assertSafeImportImageUrl('https://user:pass@m.atcdn.co.uk/car.jpg', 'AUTOTRADER')).toThrow('credentials');
        });

        it('rejects private/local destinations before any request is made', () => {
            expect(() => assertSafeImportImageUrl('https://127.0.0.1/car.jpg', 'AUTOTRADER')).toThrow();
            expect(() => assertSafeImportImageUrl('https://localhost/car.jpg', 'AUTOTRADER')).toThrow();
        });
    });

    describe('network address filtering', () => {
        it.each([
            '0.0.0.1',
            '10.0.0.1',
            '100.64.0.1',
            '127.0.0.1',
            '169.254.169.254',
            '172.16.0.1',
            '192.168.1.1',
            '198.18.0.1',
            '224.0.0.1',
            '::',
            '::1',
            'fc00::1',
            'fe80::1',
            'ff02::1',
            '2001:db8::1',
            '::ffff:127.0.0.1',
        ])('blocks %s', (address) => {
            expect(isBlockedNetworkAddress(address)).toBe(true);
        });

        it.each([
            '1.1.1.1',
            '8.8.8.8',
            '2606:4700:4700::1111',
        ])('allows public address %s', (address) => {
            expect(isBlockedNetworkAddress(address)).toBe(false);
        });
    });

    describe('content verification', () => {
        it('recognises supported image signatures', () => {
            expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xdb]))).toEqual({
                mimeType: 'image/jpeg',
                extension: 'jpg',
            });

            expect(detectImageType(Buffer.from([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]))).toEqual({
                mimeType: 'image/png',
                extension: 'png',
            });

            expect(detectImageType(Buffer.from('RIFF0000WEBP', 'ascii'))).toEqual({
                mimeType: 'image/webp',
                extension: 'webp',
            });
        });

        it('rejects HTML/text disguised as an image response', () => {
            expect(detectImageType(Buffer.from('<html>not an image</html>'))).toBeNull();
        });
    });
});
