import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { signSimpleDmsLink } from './simpledms-referral.service';

// Strict database selection + explicit output mapping. Neither an ORM object
// nor an existing auction endpoint is ever passed through to a partner.
const PARTNER_SELECT = {
  id: true,
  listingId: true,
  startTime: true,
  endTime: true,
  updatedAt: true,
  startingBid: true,
  listing: {
    select: {
      title: true,
      make: true,
      model: true,
      year: true,
      mileage: true,
      variant: true,
      vehicleType: true,
      fuelType: true,
      transmission: true,
      bodyType: true,
      color: true,
      engineSize: true,
      images: true,
      vrm: true,
      location: true,
      updatedAt: true,
    },
  },
} as const;

type SelectedAuction = Prisma.AuctionGetPayload<{ select: typeof PARTNER_SELECT }>;

@Injectable()
export class SimpleDmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isEnabled(name: string): boolean {
    return this.config.get<string>(name) === 'true';
  }

  private liveWhere(now: Date): Prisma.AuctionWhereInput {
    return {
      status: 'ACTIVE',
      deletedAt: null,
      startTime: { lte: now },
      endTime: { gt: now },
      listing: {
        is: {
          type: 'AUCTION',
          status: 'ACTIVE',
          deletedAt: null,
          partnerDistributionAcceptedAt: { not: null },
        },
      },
    };
  }

  private publicAuctionUrl(id: string): string {
    // Synthetic staging must NEVER direct test dealers to real CarMazium
    // auctions, even if production defaults are left elsewhere in the repo.
    if (this.isEnabled('STAGING_SYNTHETIC_ONLY')) {
      const host = this.config.get<string>('STAGING_PUBLIC_HOST') || '';
      if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.up\.railway\.app$/.test(host))
        throw new Error('Synthetic staging requires a Railway synthetic-only host');
      return 'https://' + host + '/staging-auctions/' + encodeURIComponent(id);
    }
    const configured = this.config.get<string>('PARTNER_API_PUBLIC_BASE_URL') || 'https://carmazium.com';
    // Do not allow environment errors to produce a partner-controlled redirect.
    let origin = 'https://carmazium.com';
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' &&
          (url.hostname === 'carmazium.com' || url.hostname.endsWith('.carmazium.com'))) {
        origin = url.origin;
      }
    } catch { /* safely retain the canonical production origin */ }
    return origin + '/auctions/live/' + encodeURIComponent(id) + '?utm_source=simpledms&utm_medium=partner_api';
  }

  // An ordinary auction URL is never presented as an attributable referral.
  // Misconfigured signing/host settings must not silently overstate conversion tracking.
  private referralLink(id: string): string | null {
    const raw = this.config.get<string>('PARTNER_API_REFERRAL_BACKEND_URL') || '';
    if (!raw) return null;
    try {
      const url = new URL(raw);
      // Never generate links to arbitrary endpoints supplied by configuration.
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          url.pathname !== '/' || url.search || url.hash ||
          !(['carmazium-hjoh9w.fly.dev', 'api.carmazium.com'].includes(url.hostname)
            || url.hostname.endsWith('.carmazium.com'))) return null;
      const secret = this.config.get<string>('PARTNER_API_REFERRAL_SIGNING_SECRET') || '';
      if (secret.length < 32) return null;
      // The link is issued only inside an authenticated partner feed.
      const expires = Date.now() + 24 * 60 * 60 * 1000;
      const signature = signSimpleDmsLink(id, expires, secret);
      return url.origin + '/partners/referrals/simpledms/go/' + encodeURIComponent(id) +
        '?expires=' + expires + '&signature=' + encodeURIComponent(signature);
    } catch {
      return null;
    }
  }

  private publicImages(images: string[]): string[] {
    if (!this.isEnabled('PARTNER_API_SIMPLEDMS_SHARE_IMAGES')) return [];
    const hosts = (this.config.get<string>('PARTNER_API_PUBLIC_IMAGE_HOSTS') || '')
      .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);

    if (hosts.length === 0) return [];
    return images.map((image) => {
      // CarMazium photo-editor presentation metadata lives exclusively in the
      // hash fragment, not at the storage origin. Strip only our own marker.
      if (image.includes('#cm-photo=')) return image.split('#cm-photo=')[0];
      return image;
    }).filter((image) => {
      try {
        const url = new URL(image);
        if (url.protocol !== 'https:' ||
            !hosts.includes(url.hostname.toLowerCase()) ||
            url.username || url.password || url.search || url.hash) return false;

        // Supabase signed/private object URLs must never be syndicated, even
        // if the Supabase project domain was explicitly allowlisted.
        if (url.hostname.endsWith('.supabase.co') &&
            !url.pathname.startsWith('/storage/v1/object/public/listings/')) return false;
        return !/(?:^|\/)(?:private|kyc|identity|documents|handover|auction-handover-documents)(?:\/|$)/i.test(url.pathname);
      } catch {
        return false;
      }
    }).slice(0, 12);
  }

  // Never infer a town from an unstructured seller address. An explicit
  // approved town/region allowlist prevents accidentally syndicating postcodes.
  private approvedRegion(raw: string | null): string | null {
    if (!this.isEnabled('PARTNER_API_SIMPLEDMS_SHARE_REGION') || !raw) return null;
    const allowed = (this.config.get<string>('PARTNER_API_SIMPLEDMS_ALLOWED_REGIONS') || '')
      .split(',').map(v => v.trim()).filter(Boolean);
    return allowed.find(v => v.toLowerCase() === raw.trim().toLowerCase()) || null;
  }

  private async mapAuction(auction: SelectedAuction) {
    const listing = auction.listing;
    const referral = this.isEnabled('PARTNER_API_SIMPLEDMS_REFERRALS_ENABLED')
      ? this.referralLink(auction.id) : null;
    const output: Record<string, unknown> = {
      id: auction.id,
      listingId: auction.listingId,
      title: listing.title,
      vehicle: {
        type: listing.vehicleType,
        make: listing.make,
        model: listing.model,
        variant: listing.variant,
        year: listing.year,
        mileage: listing.mileage,
        fuel: listing.fuelType,
        transmission: listing.transmission,
        bodyType: listing.bodyType,
        colour: listing.color,
        engineSizeCc: listing.engineSize,
      },
      auction: {
        status: 'ACTIVE',
        startTime: auction.startTime.toISOString(),
        endTime: auction.endTime.toISOString(),
        startingBidGbp: Number(auction.startingBid),
      },
      images: this.publicImages(listing.images || []),
      region: this.approvedRegion(listing.location),
      updatedAt: new Date(Math.max(auction.updatedAt.getTime(), listing.updatedAt.getTime())).toISOString(),
      url: this.publicAuctionUrl(auction.id),
      // Optional signed redirect: the direct URL remains the fallback while
      // partner referral tracking is not configured/enabled.
      ...(referral ? { referralUrl: referral } : {}),
    };

    if (this.isEnabled('PARTNER_API_SIMPLEDMS_SHARE_REGISTRATION')) {
      (output.vehicle as Record<string, unknown>).registration = listing.vrm;
    }

    // Optional extra market data; defaults OFF. Only eligible bids from the
    // current auction run are considered; no bidder identities are selected.
    if (this.isEnabled('PARTNER_API_SIMPLEDMS_SHARE_CURRENT_BID')) {
      const highest = await this.prisma.bid.findFirst({
        where: {
          listingId: auction.listingId,
          // Ignore clock-invalid future bids and all older auction runs.
          createdAt: { gte: auction.startTime, lte: new Date() },
          deletedAt: null,
          cancelledAt: null,
          archivedAt: null,
        },
        orderBy: { amount: 'desc' },
        select: { amount: true },
      });
      (output.auction as Record<string, unknown>).currentBidGbp = highest ? Number(highest.amount) : null;
    }

    return output;
  }

  async list(page: number, limit: number) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('page must be 1–1000 and limit must be 1–50');
    }

    const now = new Date();
    const where = this.liveWhere(now);
    const [auctions, total] = await Promise.all([
      this.prisma.auction.findMany({
        where,
        select: PARTNER_SELECT,
        orderBy: [{ endTime: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auction.count({ where }),
    ]);

    return {
      version: '1',
      generatedAt: now.toISOString(),
      pagination: { page, limit, total, hasMore: page * limit < total },
      auctions: await Promise.all(auctions.map((auction) => this.mapAuction(auction))),
    };
  }

  async detail(id: string) {
    const auction = await this.prisma.auction.findFirst({
      where: { ...this.liveWhere(new Date()), id },
      select: PARTNER_SELECT,
    });
    if (!auction) throw new NotFoundException('Live auction not found');
    return { version: '1', generatedAt: new Date().toISOString(), auction: await this.mapAuction(auction) };
  }
}
