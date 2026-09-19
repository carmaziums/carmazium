import { BadRequestException } from '@nestjs/common';
import {
    normaliseUkPostcode,
    parseFutureRequestedFor,
    postcodeArea,
    requireUkPostcode,
} from './service-validation';

describe('TradeXchange service validation', () => {
    it('normalises valid UK postcodes and extracts the postcode area', () => {
        expect(normaliseUkPostcode(' b19 1es ')).toBe('B19 1ES');
        expect(requireUkPostcode('sw1a 1aa', 'Postcode')).toBe('SW1A 1AA');
        expect(postcodeArea('SW1A 1AA')).toBe('SW');
    });

    it('rejects malformed UK postcodes instead of accepting arbitrary short strings', () => {
        expect(normaliseUkPostcode('ZZ99 9ZZ')).toBeNull();
        expect(() => requireUkPostcode('not-a-postcode', 'Pickup postcode'))
            .toThrow(BadRequestException);
    });

    it('rejects past requested dates and accepts future dates', () => {
        expect(() => parseFutureRequestedFor(new Date(Date.now() - 60 * 60 * 1000).toISOString()))
            .toThrow(BadRequestException);

        const future = new Date(Date.now() + 60 * 60 * 1000);
        expect(parseFutureRequestedFor(future.toISOString())?.getTime()).toBe(future.getTime());
        expect(parseFutureRequestedFor(undefined)).toBeNull();
    });
});
