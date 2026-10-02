import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { resolveBusinessBuyerId } from '../dealers/dealer-access';

type ReferralToken = { partner: 'simpledms'; auctionId: string; iat: number };
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SimpleDmsReferralService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private enabled() {
    if (this.config.get<string>('PARTNER_API_ENABLED') !== 'true' ||
        this.config.get<string>('PARTNER_API_SIMPLEDMS_ENABLED') !== 'true' ||
        this.config.get<string>('PARTNER_API_SIMPLEDMS_REFERRALS_ENABLED') !== 'true') {
      throw new NotFoundException();
    }
  }

  private secret(): string {
    const key = this.config.get<string>('PARTNER_API_REFERRAL_SIGNING_SECRET') || '';
    if (key.length < 32) throw new ServiceUnavailableException('Partner referrals are not configured');
    return key;
  }

  private sign(value: string, secret: string) {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private decode(token: string): ReferralToken {
    const secret = this.secret();
    if (!token || token.length > 512 || !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token)) {
      throw new BadRequestException('Invalid referral token');
    }
    const [encoded, supplied] = token.split('.');
    const expected = this.sign(encoded, secret);
    if (supplied.length !== expected.length ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      throw new BadRequestException('Invalid referral token');
    }
    let parsed: ReferralToken;
    try { parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
    catch { throw new BadRequestException('Invalid referral token'); }
    const age = Date.now() - parsed?.iat;
    if (parsed?.partner !== 'simpledms' || !UUID.test(parsed?.auctionId || '') ||
        !Number.isFinite(age) || age < -60_000 || age > TOKEN_MAX_AGE_MS) {
      throw new BadRequestException('Expired or invalid referral token');
    }
    return parsed;
  }

  /** Server redirects via a fixed CarMazium host: never accepts a return URL. */
  async visit(id: string) {
    this.enabled();
    const secret = this.secret();
    if (!UUID.test(id)) throw new NotFoundException();
    const live = await this.prisma.auction.findFirst({
      where: {
        id, status: 'ACTIVE', deletedAt: null,
        startTime: { lte: new Date() }, endTime: { gt: new Date() },
        listing: { is: { type: 'AUCTION', status: 'ACTIVE', deletedAt: null } },
      },
      select: { id: true },
    });
    if (!live) throw new NotFoundException('Live auction not found');
    const payload: ReferralToken = { partner: 'simpledms', auctionId: id, iat: Date.now() };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const token = encoded + '.' + this.sign(encoded, secret);
    // Non-identifying click count. Do not log IP, registration or browser identity.
    await this.prisma.analyticsEvent.create({
      data: { type: 'partner_simpledms_redirect', payload: { auctionId: id } },
    }).catch(() => null);
    const base = this.config.get<string>('PARTNER_API_PUBLIC_BASE_URL') || 'https://carmazium.com';
    let origin = 'https://carmazium.com';
    try {
      const u = new URL(base);
      if (u.protocol === 'https:' &&
          (u.hostname === 'carmazium.com' || u.hostname.endsWith('.carmazium.com'))) origin = u.origin;
    } catch { /* canonical host */ }
    return origin + '/auctions/live/' + encodeURIComponent(id) +
      '?utm_source=simpledms&utm_medium=partner_api&partner_ref=' + encodeURIComponent(token);
  }

  /** The signed token is proof of a tagged visit, NOT proof of a purchase. */
  async claim(userId: string, role: string, token: string) {
    this.enabled();
    if (role !== 'DEALER') throw new ForbiddenException('Dealer account required');
    const payload = this.decode(token);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, deletedAt: true, createdAt: true },
    });
    if (!user || user.deletedAt || user.role !== 'DEALER') {
      throw new ForbiddenException('Dealer account required');
    }
    const auction = await this.prisma.auction.findUnique({
      where: { id: payload.auctionId },
      select: { id: true, listingId: true },
    });
    if (!auction) throw new NotFoundException();
    const buyerId = await resolveBusinessBuyerId(this.prisma, userId);
    // Repeated page loads should not inflate the same partner claim.
    const existing = await this.prisma.analyticsEvent.findFirst({
      where: { type: 'partner_simpledms_claim', userId, payload: { path: ['auctionId'], equals: payload.auctionId } },
      select: { id: true },
    });
    if (existing) return { attributed: true };
    await this.prisma.analyticsEvent.create({
      data: {
        type: 'partner_simpledms_claim', userId,
        payload: {
          partner: 'simpledms', auctionId: payload.auctionId,
          listingId: auction.listingId, buyerId,
          clickedAt: new Date(payload.iat).toISOString(),
        },
      },
    });
    return { attributed: true };
  }

  /** Internal admin metrics only. No per-user data returned to a partner. */
  async report(days = 90) {
    this.enabled();
    if (!Number.isInteger(days) || days < 1 || days > 90) throw new BadRequestException('days must be 1–90');
    const from = new Date(Date.now() - days * 86400_000);
    const [clicks, rows] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: { type: 'partner_simpledms_redirect', createdAt: { gte: from } } }),
      this.prisma.analyticsEvent.findMany({
        where: { type: 'partner_simpledms_claim', createdAt: { gte: from } },
        select: { userId: true, createdAt: true, payload: true },
        orderBy: { createdAt: 'asc' }, take: 10001,
      }),
    ]);
    if (rows.length > 10000) {
      throw new ServiceUnavailableException('Attribution reporting requires paginated aggregation');
    }
    const claims = new Map<string, { userId: string; buyerId: string; listingId: string; auctionId: string; clickedAt: Date }>();
    for (const row of rows) {
      const p = row.payload as Record<string, unknown>;
      if (!row.userId || p?.partner !== 'simpledms' ||
          typeof p.listingId !== 'string' || typeof p.auctionId !== 'string' ||
          typeof p.buyerId !== 'string' || typeof p.clickedAt !== 'string') continue;
      const at = new Date(p.clickedAt);
      if (!Number.isFinite(at.getTime()) || at > row.createdAt ||
          row.createdAt.getTime() - at.getTime() > TOKEN_MAX_AGE_MS) continue;
      const key = row.userId + ':' + p.auctionId;
      if (!claims.has(key)) claims.set(key, {
        userId: row.userId, buyerId: p.buyerId, listingId: p.listingId,
        auctionId: p.auctionId, clickedAt: at,
      });
    }
    const all = [...claims.values()];
    if (!all.length) return { periodDays: days, taggedRedirects: clicks, attributedDealers: 0, newDealerAccounts: 0, bids: 0, completedPurchases: 0 };
    const users = [...new Set(all.map(c => c.userId))];
    const buyers = [...new Set(all.map(c => c.buyerId))];
    const listings = [...new Set(all.map(c => c.listingId))];
    const [accounts, bids, sales, auctions] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: users }, role: 'DEALER' },
        select: { id: true, createdAt: true } }),
      this.prisma.bid.findMany({
        where: { listingId: { in: listings }, bidderId: { in: buyers },
          deletedAt: null, cancelledAt: null, archivedAt: null },
        select: { id: true, listingId: true, bidderId: true, createdAt: true },
      }),
      this.prisma.sale.findMany({
        where: { listingId: { in: listings }, buyerId: { in: buyers } },
        select: { id: true, listingId: true, buyerId: true, createdAt: true },
      }),
      this.prisma.auction.findMany({
        where: { id: { in: all.map(c => c.auctionId) } },
        select: { id: true, listingId: true, buyerFeePaid: true,
          sellerBonusReleased: true, buyerRefusedAt: true, status: true },
      }),
    ]);
    const registrationIds = new Set<string>();
    const bidIds = new Set<string>();
    const completedIds = new Set<string>();
    const status = new Map(auctions.map(a => [a.id, a]));
    for (const c of all) {
      const account = accounts.find(u => u.id === c.userId);
      if (account && account.createdAt >= c.clickedAt &&
          account.createdAt.getTime() - c.clickedAt.getTime() <= TOKEN_MAX_AGE_MS) {
        registrationIds.add(c.userId);
      }
      // Attribution is limited to the specific vehicle clicked; no claims
      // for unrelated purchases by the same dealer.
      const auction = status.get(c.auctionId);
      if (!auction || auction.listingId !== c.listingId) continue;
      for (const bid of bids) {
        if (bid.bidderId === c.buyerId && bid.listingId === c.listingId &&
            bid.createdAt >= c.clickedAt &&
            bid.createdAt.getTime() - c.clickedAt.getTime() <= 30 * 86400_000) bidIds.add(bid.id);
      }
      // A Sale row alone is NOT a completed purchase. Require approved
      // handover plus fee lifecycle completion, and exclude buyer refusals.
      if (auction.status === 'ENDED' && auction.buyerFeePaid &&
          auction.sellerBonusReleased && !auction.buyerRefusedAt) {
        for (const sale of sales) {
          if (sale.buyerId === c.buyerId && sale.listingId === c.listingId &&
              sale.createdAt >= c.clickedAt &&
              sale.createdAt.getTime() - c.clickedAt.getTime() <= 30 * 86400_000) completedIds.add(sale.id);
        }
      }
    }
    return { periodDays: days, taggedRedirects: clicks,
      attributedDealers: new Set(all.map(c => c.buyerId)).size,
      newDealerAccounts: registrationIds.size, bids: bidIds.size,
      completedPurchases: completedIds.size };
  }
}
