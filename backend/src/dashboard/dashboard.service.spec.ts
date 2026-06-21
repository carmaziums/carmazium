import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  bid: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  offer: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  watchlistItem: { count: jest.fn().mockResolvedValue(0) },
  auction: { count: jest.fn().mockResolvedValue(0) },
  sale: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn().mockResolvedValue({ _sum: { soldPrice: 0 } }) },
  listing: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { viewCount: 0 } }), findMany: jest.fn().mockResolvedValue([]) },
  lead: { groupBy: jest.fn().mockResolvedValue([]) },
  dealerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'dp-1' }) },
  dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
};

describe('DashboardService — period filter', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  it('DASH-FILTER-01: getBuyerDashboard with 7d passes createdAt gte ~7 days ago to bid.count', async () => {
    const before = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getBuyerDashboard('user-1', '7d');
    expect(mockPrisma.bid.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date) }) }) })
    );
    const callArg = mockPrisma.bid.count.mock.calls[0][0];
    expect(callArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });

  it('DASH-FILTER-01-default: getBuyerDashboard defaults to 30d when period omitted', async () => {
    const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getBuyerDashboard('user-1');
    const callArg = mockPrisma.bid.count.mock.calls[0][0];
    expect(callArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });

  it('DASH-FILTER-02: getSellerDashboard with 30d passes createdAt gte ~30 days ago to offer.count', async () => {
    const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getSellerDashboard('user-1', '30d');
    const callArg = mockPrisma.offer.count.mock.calls[0][0];
    expect(callArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });

  it('DASH-FILTER-03: getDealerDashboard with 7d passes createdAt gte ~7 days ago to sale.count', async () => {
    const before = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getDealerDashboard('user-1', '7d');
    const callArg = mockPrisma.sale.count.mock.calls[0][0];
    expect(callArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });
});
