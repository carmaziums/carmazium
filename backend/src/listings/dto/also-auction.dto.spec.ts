import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AlsoAuctionDto } from './also-auction.dto';

describe('AlsoAuctionDto', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    });

    const transform = (payload: Record<string, unknown>) =>
        pipe.transform(payload, {
            type: 'body',
            metatype: AlsoAuctionDto,
            data: '',
        });

    it('accepts and transforms the complete linked-auction payload', async () => {
        await expect(transform({
            startTime: new Date(Date.now() + 60_000).toISOString(),
            reservePrice: '9000',
            startingBid: '7000',
            minIncrement: '100',
            buyItNowPrice: '12000',
        })).resolves.toMatchObject({
            reservePrice: 9000,
            startingBid: 7000,
            minIncrement: 100,
            buyItNowPrice: 12000,
        });
    });

    it.each([
        [{ reservePrice: 9000 }, 'missing startTime'],
        [{ startTime: '2026-09-19T12:00:00.000Z' }, 'missing reservePrice'],
        [{ startTime: '2026-09-19T12:00:00.000Z', reservePrice: -1 }, 'negative reserve'],
        [{ startTime: '2026-09-19T12:00:00.000Z', reservePrice: 9000, minIncrement: 0 }, 'zero increment'],
    ])('rejects %s (%s)', async (payload, _reason) => {
        await expect(transform(payload as Record<string, unknown>))
            .rejects.toBeInstanceOf(BadRequestException);
    });
});
