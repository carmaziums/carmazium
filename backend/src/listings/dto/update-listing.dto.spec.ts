import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateListingDto } from './update-listing.dto';

describe('UpdateListingDto protected fields', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    });

    const transform = (payload: Record<string, unknown>) =>
        pipe.transform(payload, {
            type: 'body',
            metatype: UpdateListingDto,
            data: '',
        });

    it.each([
        ['status', 'ACTIVE'],
        ['listingType', 'AUCTION'],
        ['badgeTier', 'PREMIUM'],
    ])('rejects seller PATCH payloads containing protected field %s', async (field, value) => {
        await expect(
            transform({
                title: 'Updated vehicle title',
                [field]: value,
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still accepts ordinary seller-editable fields', async () => {
        await expect(
            transform({ title: 'Updated vehicle title' }),
        ).resolves.toMatchObject({ title: 'Updated vehicle title' });
    });
});
