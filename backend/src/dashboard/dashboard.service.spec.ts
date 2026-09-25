import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  bid: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  offer: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  watchlistItem: { count: jest.fn().mockResolvedValue(0) },
  auction: { count: jest.fn().mockResolvedValue(0) },
  sale: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn().mockResolvedValue({ _sum: { soldPrice: 0 } }) },
  listing: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { viewCount: 0 }, _count: { id: 0 } }), findMany: jest.fn().mockResolvedValue([]) },
  lead: { groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  dealerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'dp-1', userId: 'user-1', isVerified: true, companyName: 'Test Motors', createdAt: new Date('2025-01-01T00:00:00.000Z'), staff: [] }) },
  dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
  message: { count: jest.fn().mockResolvedValue(0) },
  transaction: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    count: jest.fn().mockResolvedValue(0),
  },
  user: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
  partnerProfile: { findFirst: jest.fn().mockResolvedValue(null) },
  financeApplication: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
  insuranceQuote: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ views: 0n }]),
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

  it('DASH-FILTER-01: buyer won/spend metrics use the selected 7-day period', async () => {
    const before = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getBuyerDashboard('user-1', '7d');

    const auctionArg = mockPrisma.auction.count.mock.calls[0][0];
    expect(auctionArg.where.wonAt.gte.getTime()).toBeGreaterThan(before.getTime());

    const saleArg = mockPrisma.sale.aggregate.mock.calls[0][0];
    expect(saleArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });

  it('DASH-FILTER-01-default: buyer won/spend metrics default to 30 days', async () => {
    const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getBuyerDashboard('user-1');

    const saleArg = mockPrisma.sale.aggregate.mock.calls[0][0];
    expect(saleArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });

  it('BUYER-KPI-01: totalSpent is sourced from canonical buyer Sale rows', async () => {
    mockPrisma.sale.aggregate.mockResolvedValueOnce({ _sum: { soldPrice: 18750 } });

    const result = await (service as any).getBuyerDashboard('buyer-1', '30d');

    expect(result.totalSpent).toBe(18750);
    expect(mockPrisma.sale.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ buyerId: 'buyer-1' }),
        _sum: { soldPrice: true },
      }),
    );
  });

  it('BUYER-KPI-02: activeBids counts distinct live auctions, not bid rows or offers', async () => {
    mockPrisma.bid.findMany
      .mockResolvedValueOnce([{ listingId: 'listing-1' }, { listingId: 'listing-2' }])
      .mockResolvedValueOnce([]);

    const result = await (service as any).getBuyerDashboard('buyer-1', '30d');

    expect(result.activeBids).toBe(2);
    expect(mockPrisma.bid.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        distinct: ['listingId'],
        where: expect.objectContaining({
          bidderId: 'buyer-1',
          cancelledAt: null,
          archivedAt: null,
        }),
      }),
    );
  });

  it('DASH-FILTER-02: getSellerDashboard with 30d passes createdAt gte ~30 days ago to offer.count', async () => {
    const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getSellerDashboard('user-1', '30d');
    const callArg = mockPrisma.offer.count.mock.calls[0][0];
    expect(callArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });

  it('UNIFIED-KPI-01: unified activeBids is actual live-auction participation', async () => {
    mockPrisma.bid.findMany.mockResolvedValueOnce([
      { listingId: 'listing-1' },
      { listingId: 'listing-2' },
    ]);
    mockPrisma.sale.count.mockResolvedValueOnce(4);
    mockPrisma.listing.count.mockResolvedValue(0);
    mockPrisma.listing.aggregate.mockResolvedValue({ _sum: { viewCount: 0 } });
    mockPrisma.sale.aggregate.mockResolvedValue({ _sum: { soldPrice: 0 } });

    const result = await (service as any).getUnifiedDashboard('buyer-1');

    expect(result.buyer.activeBids).toBe(2);
    expect(result.seller.soldListings).toBe(4);
  });

  it('SELLER-KPI-01: seller dashboard returns selected-period sales, revenue, views and 0% sale fee', async () => {
    mockPrisma.listing.count.mockResolvedValueOnce(3);
    mockPrisma.auction.count.mockResolvedValueOnce(1);
    mockPrisma.offer.count.mockResolvedValueOnce(2);
    mockPrisma.watchlistItem.count.mockResolvedValueOnce(5);
    mockPrisma.offer.findMany.mockResolvedValueOnce([]);
    mockPrisma.sale.findMany.mockResolvedValueOnce([
      {
        id: 'sale-1',
        soldPrice: 10000,
        listing: { title: 'Test Vehicle' },
        createdAt: new Date(),
      },
    ]);
    mockPrisma.sale.count.mockResolvedValueOnce(1);
    mockPrisma.sale.aggregate.mockResolvedValueOnce({ _sum: { soldPrice: 10000 } });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ views: 44n }]);

    const result = await (service as any).getSellerDashboard('seller-1', '30d');

    expect(result.activeListings).toBe(3);
    expect(result.soldListings).toBe(1);
    expect(result.totalRevenue).toBe(10000);
    expect(result.totalViews).toBe(44);
    expect(result.earnings[0]).toEqual(expect.objectContaining({
      soldPrice: 10000,
      platformFee: 0,
      net: 10000,
    }));
  });

  it('ADMIN-KPI-01: admin dashboard excludes deleted rows and non-retained payment throughput', async () => {
    mockPrisma.user.count.mockResolvedValueOnce(503);
    mockPrisma.listing.count.mockResolvedValueOnce(479);
    mockPrisma.auction.count.mockResolvedValueOnce(2);
    mockPrisma.transaction.aggregate.mockResolvedValueOnce({ _sum: { amount: 202.92 } });
    mockPrisma.transaction.count.mockResolvedValueOnce(8);
    mockPrisma.user.findMany.mockResolvedValueOnce([]);

    const result = await (service as any).getAdminDashboard();

    expect(result).toEqual(expect.objectContaining({
      totalUsers: 503,
      totalListings: 479,
      activeAuctions: 2,
      totalRevenue: 402.92,
    }));
    expect(mockPrisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED', deletedAt: null }),
      }),
    );
  });

  it('FINANCE-PARTNER-01: finance dashboard is scoped to the logged-in partner profile', async () => {
    mockPrisma.partnerProfile.findFirst.mockResolvedValueOnce({ id: 'finance-profile-1' });
    mockPrisma.financeApplication.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    mockPrisma.financeApplication.findMany.mockResolvedValueOnce([]);

    const result = await (service as any).getFinanceDashboard('finance-user-1');

    expect(result.stats).toEqual({ pending: 2, approved: 3, rejected: 1 });
    for (const call of mockPrisma.financeApplication.count.mock.calls.slice(-3)) {
      expect(call[0].where).toEqual(expect.objectContaining({
        partnerId: 'finance-profile-1',
        deletedAt: null,
      }));
    }
  });

  it('INSURANCE-PARTNER-01: insurance dashboard uses insuranceUserId and partner scoping', async () => {
    mockPrisma.partnerProfile.findFirst.mockResolvedValueOnce({ id: 'insurance-profile-1' });
    mockPrisma.insuranceQuote.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    mockPrisma.insuranceQuote.findMany.mockResolvedValueOnce([]);

    const result = await (service as any).getInsuranceDashboard('insurance-user-1');

    expect(result.stats).toEqual({ pending: 4, quoted: 5, declined: 2 });
    expect(mockPrisma.partnerProfile.findFirst).toHaveBeenCalledWith({
      where: {
        insuranceUserId: 'insurance-user-1',
        partnerType: 'INSURANCE_PARTNER',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    for (const call of mockPrisma.insuranceQuote.count.mock.calls.slice(-3)) {
      expect(call[0].where).toEqual(expect.objectContaining({
        partnerId: 'insurance-profile-1',
        deletedAt: null,
      }));
    }
  });

  it('DEALER-KPI-01: current stock is not restricted by the 7/30 day reporting window', async () => {
    await (service as any).getDealerDashboard('user-1', '7d');

    const listingCountArg = mockPrisma.listing.count.mock.calls[0][0];
    expect(listingCountArg.where).toEqual({
      sellerId: 'user-1',
      status: 'ACTIVE',
      deletedAt: null,
    });
    expect(listingCountArg.where.createdAt).toBeUndefined();
  });

  it('DEALER-KPI-02: returns the real fields consumed by the dealer dashboard', async () => {
    mockPrisma.listing.count.mockResolvedValueOnce(4);
    mockPrisma.auction.count.mockResolvedValueOnce(2);
    mockPrisma.sale.count.mockResolvedValueOnce(3);
    mockPrisma.lead.groupBy.mockResolvedValueOnce([
      { status: 'NEW', _count: { status: 2 } },
      { status: 'CONTACTED', _count: { status: 1 } },
      { status: 'WON', _count: { status: 5 } },
      { status: 'LOST', _count: { status: 1 } },
    ]);
    mockPrisma.listing.aggregate.mockResolvedValueOnce({ _sum: { viewCount: 120 }, _count: { id: 4 } });
    mockPrisma.sale.aggregate.mockResolvedValueOnce({ _sum: { soldPrice: 27500 } });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ views: 18n }]);
    mockPrisma.dealerProfile.findUnique.mockResolvedValue({
      id: 'dp-1',
      userId: 'user-1',
      isVerified: true,
      companyName: 'Test Motors',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      staff: [{ id: 'staff-1' }],
    });

    const result = await (service as any).getDealerDashboard('user-1', '30d');

    expect(result).toEqual(expect.objectContaining({
      companyName: 'Test Motors',
      isVerified: true,
      activeListings: 4,
      activeAuctions: 2,
      totalViews: 18,
      soldListings: 3,
      activeLeads: 3,
      totalRevenue: 27500,
      staffCount: 2,
      allTimeViews: 120,
      avgViews: 30,
    }));
  });

  it('DEALER-RANGE-ALL: all-time range starts at dealer account creation', async () => {
    await (service as any).getDealerDashboard('user-1', { allTime: true });
    const callArg = mockPrisma.sale.count.mock.calls[0][0];
    expect(callArg.where.createdAt.gte.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('DEALER-RANGE-COMPARE: custom month ranges can request a previous-period comparison', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ views: 12n }])
      .mockResolvedValueOnce([{ views: 8n }]);
    mockPrisma.sale.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.sale.aggregate
      .mockResolvedValueOnce({ _sum: { soldPrice: 30000 } })
      .mockResolvedValueOnce({ _sum: { soldPrice: 20000 } });
    mockPrisma.lead.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);

    const result = await (service as any).getDealerDashboard('user-1', {
      rangeValue: 1,
      rangeUnit: 'months',
      compare: true,
    });

    expect(result.comparison.available).toBe(true);
    expect(result.comparison.totalViews).toEqual(expect.objectContaining({ current: 12, previous: 8 }));
    expect(result.comparison.soldListings).toEqual(expect.objectContaining({ current: 3, previous: 2 }));
  });

  it('DASH-FILTER-03: getDealerDashboard with 7d passes createdAt gte ~7 days ago to sale.count', async () => {
    const before = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000);
    await (service as any).getDealerDashboard('user-1', '7d');
    const callArg = mockPrisma.sale.count.mock.calls[0][0];
    expect(callArg.where.createdAt.gte.getTime()).toBeGreaterThan(before.getTime());
  });
});
