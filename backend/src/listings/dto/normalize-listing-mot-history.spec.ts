import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';
import { UpdateListingDto } from './update-listing.dto';
import { normalizeListingMotHistory } from './normalize-listing-mot-history';

const motTest = {
    completedDate: '2026-10-01 10:30:00',
    testResult: 'PASSED',
    expiryDate: '2027-10-01',
    odometerValue: '43012',
    odometerUnit: 'MI',
    motTestNumber: '123456789012',
    defects: [{ text: 'Tyre wearing', type: 'ADVISORY', dangerous: false }],
};

describe('shared retail and auction MOT history payload compatibility', () => {
    it('keeps authoritative MOT records and nested defects unchanged', () => {
        const history = [motTest];
        expect(normalizeListingMotHistory(history)).toEqual(history);
        expect(normalizeListingMotHistory(history)).not.toBe(history);
    });

    it('recovers individual JSON-serialized MOT tests from a stale client draft', () => {
        expect(normalizeListingMotHistory([JSON.stringify(motTest)])).toEqual([motTest]);
    });

    it('recovers a JSON-serialized MOT test array', () => {
        expect(normalizeListingMotHistory(JSON.stringify([motTest]))).toEqual([motTest]);
    });

    it('omits null, nested arrays and unparseable records, without inventing test data', () => {
        expect(normalizeListingMotHistory([null, 'corrupt', [], '42', JSON.stringify(motTest), motTest]))
            .toEqual([motTest, motTest]);
        expect(normalizeListingMotHistory(['corrupt'])).toEqual([]);
    });

    it('leaves non-array object payloads invalid for DTO validation', async () => {
        const instance = plainToInstance(UpdateListingDto, { motHistory: { invalid: true } });
        const errors = await validate(instance);
        expect(errors.some((error) => error.property === 'motHistory')).toBe(true);
    });

    it.each(['CLASSIFIED', 'AUCTION'])('accepts restored MOT objects in %s creation DTO', async (type) => {
        const instance = plainToInstance(CreateListingDto, {
            listingType: type,
            motHistory: [JSON.stringify(motTest), null, 'corrupt'],
        });
        expect(instance.motHistory).toEqual([motTest]);
        const errors = await validate(instance);
        expect(errors.some((error) => error.property === 'motHistory')).toBe(false);
    });

    it('allows seller editing with malformed optional MOT entries removed', async () => {
        const pipe = new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        });
        const dto = await pipe.transform(
            { motHistory: [motTest, 'corrupt', JSON.stringify(motTest)] },
            { type: 'body', metatype: UpdateListingDto, data: '' },
        ) as UpdateListingDto;
        expect(dto.motHistory).toEqual([motTest, motTest]);
    });

    it('still enforces the existing maximum of 100 MOT test entries', async () => {
        const instance = plainToInstance(UpdateListingDto, {
            motHistory: Array.from({ length: 101 }, () => motTest),
        });
        expect((await validate(instance)).some((error) => error.property === 'motHistory')).toBe(true);
    });
});
