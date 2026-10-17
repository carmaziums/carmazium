import { ListingsService } from './listings.service';

describe('Server-backed valuation audit receipts', () => {
    const quote = {
        low: 16800, mid: 19800, high: 22800, source: 'CARMAZIUM_MODEL',
        retail: { suggestedAsking: 20160, suggestedMinimum: 19200 },
        auction: {
            marketValue: 16800, openingBid: 11760,
            reserveLow: 15120, reserveHigh: 16800, suggestedReserve: 16000,
        },
    };
    it('writes one authoritative receipt for every successful quote, even a reused cached result', async () => {
        const prisma: any = { analyticsEvent: { create: jest.fn().mockResolvedValue({}) } };
        const service = new ListingsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
        jest.spyOn(service as any, 'computeVehicleValue').mockResolvedValue(quote);
        const dto: any = {
            make: 'Mercedes-Benz', model: 'GLB 200', year: 2020, mileage: 50000,
            registration: 'SD70XRP', valuationId: '98fb67c4-917e-47f7-a7bb-50f5f6b3cfe3',
        };
        expect(await service.estimateVehicleValue(dto)).toBe(quote);
        expect(await service.estimateVehicleValue(dto)).toBe(quote);
        expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(2);
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'valuation_quote_issued',
                sessionId: dto.valuationId,
                payload: expect.objectContaining({
                    audit_source: 'backend_response',
                    identity: expect.objectContaining({ registration: 'SD70XRP' }),
                    valuation: expect.objectContaining({
                        auction: expect.objectContaining({ marketValue: 16800 }),
                        retail: expect.objectContaining({ suggestedAsking: 20160 }),
                    }),
                }),
            }),
        });
    });

    it('returns the quote when telemetry storage fails, leaving the existing price lock untouched', async () => {
        const prisma: any = { analyticsEvent: { create: jest.fn().mockRejectedValue(new Error('storage failure')) } };
        const service = new ListingsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
        jest.spyOn(service as any, 'computeVehicleValue').mockResolvedValue(quote);
        const result = await service.estimateVehicleValue({
            make: 'Mercedes-Benz', model: 'GLB 200', year: 2020, mileage: 50000,
            registration: 'SD70XRP',
        } as any);
        expect(result).toBe(quote);
    });
});
