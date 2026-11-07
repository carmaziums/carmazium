import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListingFilterDto } from './listing-filter.dto';

describe('listing query booleans with production implicit conversion', () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true,
        transform: true, transformOptions: { enableImplicitConversion: true } });
    const transform = (query: Record<string, unknown>) => pipe.transform(query, {
        type: 'query', metatype: ListingFilterDto, data: '',
    });
    const fields = ['ulezCompliant', 'isImported', 'markedForExport', 'includeSold',
        'deliveryAvailable', 'motValid', 'taxedOnly'];

    it.each(fields)('%s preserves both false and true without treating absence as false', async key => {
        for (const raw of ['false', false, 'true', true]) {
            expect((await transform({ [key]: raw }))[key]).toBe(raw === 'true' || raw === true);
        }
        expect((await transform({}))[key]).toBeUndefined();
    });
    it.each(fields)('%s rejects invalid strings, numbers and repeated query values', async key => {
        for (const raw of ['yes', '0', '', 1, ['false', 'true']]) {
            await expect(transform({ [key]: raw })).rejects.toBeInstanceOf(BadRequestException);
        }
    });
    it('keeps numeric ranges, enum lists and false together in a combined query', async () => {
        expect(await transform({ minEngine: '1000', maxEngine: '1600', maxCo2: '120',
            isImported: 'false', fuelTypes: 'PETROL,DIESEL', page: '2' })).toMatchObject({
            minEngine: 1000, maxEngine: 1600, maxCo2: 120, isImported: false,
            fuelTypes: ['PETROL', 'DIESEL'], page: 2,
        });
    });
});
