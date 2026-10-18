import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SimpleDmsReferralService, signSimpleDmsLink } from './simpledms-referral.service';

const AUCTION = '11111111-1111-4111-8111-111111111111';
const KEY = 'local-test-referral-signing-secret-strong-enough';
function validLink(id = AUCTION) {
  const expires = Date.now() + 60_000;
  return {expires: String(expires), sig: signSimpleDmsLink(id, expires, KEY)};
}
function visitValid(service: SimpleDmsReferralService, id = AUCTION) {
  const {expires,sig} = validLink(id);
  return service.visit(id, expires, sig);
}

function harness(overrides: Record<string, string> = {}) {
  const env = {
    PARTNER_API_ENABLED: 'true',
    PARTNER_API_SIMPLEDMS_ENABLED: 'true',
    PARTNER_API_SIMPLEDMS_REFERRALS_ENABLED: 'true',
    PARTNER_API_REFERRAL_SIGNING_SECRET: KEY,
    ...overrides,
  };
  const config: any = { get: (name: string) => env[name] };
  const prisma: any = {
    auction: {
      findFirst: jest.fn().mockResolvedValue({ id: AUCTION }),
      findUnique: jest.fn().mockResolvedValue({ id: AUCTION, listingId: 'listing-1' }),
      findMany: jest.fn().mockResolvedValue([{
        id: AUCTION, listingId: 'listing-1', winnerId: 'dealer-1', buyerFeePaid: true,
        sellerBonusReleased: true, buyerRefusedAt: null, status: 'ENDED',
      }]),
    },
    analyticsEvent: {
      create: jest.fn().mockResolvedValue({ id: 'record-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'dealer-1', role: 'DEALER', deletedAt: null, createdAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
    bid: { findMany: jest.fn().mockResolvedValue([]) },
    sale: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new SimpleDmsReferralService(prisma, config), prisma };
}

describe('SimpleDmsReferralService security and attribution', () => {
  it('never generates referrals when partner access is disabled', async () => {
    const { service } = harness({ PARTNER_API_SIMPLEDMS_REFERRALS_ENABLED: 'false' });
    await expect(visitValid(service)).rejects.toThrow(NotFoundException);
  });

  it('only redirects valid approved live auction records to the fixed CarMazium site', async () => {
    const { service, prisma } = harness();
    const url = new URL(await visitValid(service));
    expect(url.origin).toBe('https://carmazium.com');
    expect(url.pathname).toBe('/auctions/live/' + AUCTION);
    expect(url.searchParams.get('utm_source')).toBe('simpledms');
    expect(url.searchParams.get('partner_ref')).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(prisma.auction.findFirst.mock.calls[0][0].where).toMatchObject({
      status: 'ACTIVE', deletedAt: null,
      listing: { is: { type: 'AUCTION', status: 'ACTIVE', deletedAt: null } },
    });
    await expect(visitValid(service, 'https://evil.example')).rejects.toThrow(NotFoundException);
    expect(prisma.analyticsEvent.create.mock.calls[0][0].data).toEqual({
      type: 'partner_simpledms_redirect', payload: { auctionId: AUCTION },
    });
  });

  it('rejects unsigned, tampered and expired publicly guessed referral URLs', async () => {
    const {service, prisma} = harness();
    const {expires, sig} = validLink();
    await expect(service.visit(AUCTION, '', '')).rejects.toThrow(BadRequestException);
    await expect(service.visit(AUCTION, expires, sig.slice(0, -1) + 'x')).rejects.toThrow(BadRequestException);
    const old = Date.now() - 1000;
    await expect(service.visit(AUCTION, String(old), signSimpleDmsLink(AUCTION, old, KEY)))
      .rejects.toThrow(BadRequestException);
    expect(prisma.auction.findFirst).not.toHaveBeenCalled();
  });

  it('rejects spoofed, expired, and non-dealer claims without storing user events', async () => {
    const { service, prisma } = harness();
    const url = new URL(await visitValid(service));
    const signed = url.searchParams.get('partner_ref')!;
    await expect(service.claim('dealer-1', 'BUYER', signed)).rejects.toThrow(ForbiddenException);
    await expect(service.claim('dealer-1', 'DEALER', signed + 'bad')).rejects.toThrow(BadRequestException);
    expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(1); // redirect only
  });

  it('rejects expired but otherwise correctly signed tokens', async () => {
    const { createHmac } = await import('node:crypto');
    const { service } = harness();
    const payload = Buffer.from(JSON.stringify({
      partner: 'simpledms', auctionId: AUCTION, iat: Date.now() - 8 * 86400_000,
    })).toString('base64url');
    const sig = createHmac('sha256', KEY).update(payload).digest('base64url');
    await expect(service.claim('dealer-1', 'DEALER', payload + '.' + sig))
      .rejects.toThrow(BadRequestException);
  });

  it('records a genuine authenticated dealer referral once and returns no PII', async () => {
    const { service, prisma } = harness();
    const url = new URL(await visitValid(service));
    const token = url.searchParams.get('partner_ref')!;
    const claim = await service.claim('dealer-1', 'DEALER', token);
    expect(claim).toEqual({ attributed: true });
    const event = prisma.analyticsEvent.create.mock.calls[1][0].data;
    expect(event.type).toBe('partner_simpledms_claim');
    expect(event.userId).toBe('dealer-1');
    expect(event.payload).toMatchObject({
      partner: 'simpledms', auctionId: AUCTION, listingId: 'listing-1', buyerId: 'dealer-1',
    });
    prisma.analyticsEvent.findFirst.mockResolvedValue({ id: 'already-claimed' });
    expect(await service.claim('dealer-1', 'DEALER', token)).toEqual({ attributed: true });
    expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(2);
  });

  it('counts real valid bids and handover-approved sales but not unresolved sales', async () => {
    const { service, prisma } = harness();
    const visited = new Date(Date.now() - 1000).toISOString();
    prisma.analyticsEvent.findMany.mockResolvedValue([{
      userId: 'dealer-1', createdAt: new Date(),
      payload: { partner: 'simpledms', auctionId: AUCTION,
        listingId: 'listing-1', buyerId: 'dealer-1', clickedAt: visited },
    }]);
    prisma.user.findMany.mockResolvedValue([{
      id: 'dealer-1', createdAt: new Date(visited),
    }]);
    prisma.bid.findMany.mockResolvedValue([
      { id: 'bid-1', bidderId: 'dealer-1', listingId: 'listing-1', createdAt: new Date() },
    ]);
    prisma.sale.findMany.mockResolvedValue([
      { id: 'sale-1', buyerId: 'dealer-1', listingId: 'listing-1', createdAt: new Date() },
    ]);
    const success = await service.report();
    expect(success).toMatchObject({
      taggedRedirects: 1, attributedDealers: 1,
      newDealerAccounts: 1, bids: 1, completedPurchases: 1,
    });
    prisma.auction.findMany.mockResolvedValue([{
      id: AUCTION, listingId: 'listing-1', winnerId: 'dealer-1', buyerFeePaid: true,
      sellerBonusReleased: false, buyerRefusedAt: null, status: 'ENDED',
    }]);
    const pending = await service.report();
    expect(pending.completedPurchases).toBe(0);

    // A sale row on the same listing is not proof the referred business won.
    prisma.auction.findMany.mockResolvedValue([{
      id: AUCTION, listingId: 'listing-1', winnerId: 'other-dealer',
      buyerFeePaid: true, sellerBonusReleased: true,
      buyerRefusedAt: null, status: 'ENDED',
    }]);
    const wrongWinner = await service.report();
    expect(wrongWinner.bids).toBe(1); // legitimate referred bid still counted
    expect(wrongWinner.completedPurchases).toBe(0);
  });
});
