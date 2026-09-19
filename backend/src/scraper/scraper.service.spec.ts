import { ConfigService } from '@nestjs/config';
import { ScraperService } from './scraper.service';

describe('ScraperService URL boundary', () => {
    const service = new ScraperService({ get: jest.fn() } as unknown as ConfigService);

    it.each([
        ['https://www.autotrader.co.uk/car-details/123', 'AUTOTRADER'],
        ['https://sub.cargurus.co.uk/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action', 'CARGURUS'],
        ['https://www.carwow.co.uk/used-cars/123', 'CARWOW'],
    ])('recognises supported HTTPS marketplace URL %s', (url, expected) => {
        expect(service.detectPlatform(url)).toBe(expected);
    });

    it.each([
        'http://www.autotrader.co.uk/car-details/123',
        'https://user:pass@www.autotrader.co.uk/car-details/123',
        'https://autotrader.co.uk.attacker.example/car-details/123',
        'https://cargurus.co.uk.attacker.example/car',
        'https://carwow.co.uk.attacker.example/car',
        'https://example.com/?next=autotrader.co.uk',
    ])('rejects spoofed or unsafe marketplace URL %s', (url) => {
        expect(service.detectPlatform(url)).toBe('UNKNOWN');
    });
});
