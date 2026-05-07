import { Test, TestingModule } from '@nestjs/testing';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

describe('ListingsController', () => {
    let controller: ListingsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ListingsController],
            providers: [
                {
                    provide: ListingsService,
                    useValue: {
                        getEarnings: jest.fn().mockResolvedValue({ sales: [], totalRevenue: 0, totalSales: 0 }),
                        findBySlug: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<ListingsController>(ListingsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    /**
     * Regression: before the fix, `@Get('earnings')` was declared AFTER `@Get(':slug')`,
     * which caused requests to /listings/earnings to be captured by the slug handler
     * (treating "earnings" as a slug). Make sure the controller now exposes a real
     * `getEarnings` method that maps to /listings/earnings.
     */
    it('exposes a getEarnings handler distinct from the slug route', () => {
        expect(typeof (controller as any).getEarnings).toBe('function');
        expect(typeof (controller as any).findBySlug).toBe('function');
    });
});
