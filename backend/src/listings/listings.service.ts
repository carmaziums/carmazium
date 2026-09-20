import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateListingDto,
    FuelType as DtoFuelType,
    Transmission as DtoTransmission,
    BodyType as DtoBodyType,
} from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { VehicleValuationDto } from './dto/vehicle-valuation.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
import { AlsoAuctionDto } from './dto/also-auction.dto';
// These types come from @prisma/client and are available once `prisma generate` has run.
// VehicleCondition and EuroStandard are new — resolve after the migration is applied.
import {
    Listing,
    FuelType,
    TransmissionType,
    BodyType,
    ListingType,
    ListingStatus,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { SellersService } from '../sellers/sellers.service';
import { ScraperService } from '../scraper/scraper.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { buildListingActivationData } from './listing-activation';
import { brandAdminSeller, brandListingSeller } from './admin-seller-branding';
import { AUCTION_DURATION_MS, calculatePlatformOpeningBid } from '../auctions/auction-pricing';
import {
    downloadExternalImage,
    ImportedListingPlatform,
} from './external-image-import';
import {
    getListingSubmissionReadiness,
} from './listing-readiness';
import {
    calculateVehicleValuation,
    VehicleValuationComparable,
} from './vehicle-valuation';

// ─── Enum mappers ─────────────────────────────────────────────────────────────

// Map DTO enums to Prisma enums
const mapFuelType = (fuel?: DtoFuelType): FuelType | null => {
    if (!fuel) return null;
    const map: Record<DtoFuelType, FuelType> = {
        [DtoFuelType.PETROL]: 'PETROL',
        [DtoFuelType.DIESEL]: 'DIESEL',
        [DtoFuelType.ELECTRIC]: 'ELECTRIC',
        [DtoFuelType.HYBRID]: 'HYBRID',
        [DtoFuelType.PLUGIN_HYBRID]: 'PLUGIN_HYBRID',
        [DtoFuelType.LPG]: 'LPG',
        [DtoFuelType.HYDROGEN_CELL]: 'HYDROGEN_CELL',
        [DtoFuelType.BI_FUEL]: 'BI_FUEL',
        [DtoFuelType.NATURAL_GAS]: 'NATURAL_GAS',
        [DtoFuelType.PETROL_HYBRID]: 'PETROL_HYBRID',
        [DtoFuelType.DIESEL_HYBRID]: 'DIESEL_HYBRID',
        [DtoFuelType.PETROL_PLUGIN_HYBRID]: 'PETROL_PLUGIN_HYBRID',
        [DtoFuelType.DIESEL_PLUGIN_HYBRID]: 'DIESEL_PLUGIN_HYBRID',
        [DtoFuelType.UNLISTED]: 'UNLISTED',
    };
    return map[fuel];
};

const mapTransmission = (trans?: DtoTransmission): TransmissionType | null => {
    if (!trans) return null;
    const map: Record<string, TransmissionType> = {
        MANUAL: 'MANUAL',
        AUTOMATIC: 'AUTOMATIC',
        SEMI_AUTOMATIC: 'SEMI_AUTOMATIC',
        CVT: 'CVT',
    };
    return map[trans] ?? null;
};

const mapBodyType = (body?: DtoBodyType): BodyType | null => {
    if (!body) return null;
    const map: Record<string, BodyType> = {
        SEDAN: 'SEDAN',
        SUV: 'SUV',
        HATCHBACK: 'HATCHBACK',
        COUPE: 'COUPE',
        CONVERTIBLE: 'CONVERTIBLE',
        ESTATE: 'ESTATE',
        CROSSOVER: 'CROSSOVER',
        SPORTS_CAR: 'SPORTS_CAR',
        MINIVAN: 'MINIVAN',
        PICKUP_TRUCK: 'PICKUP_TRUCK',
        STATION_WAGON: 'STATION_WAGON',
        MPV: 'MPV',
        VAN: 'VAN',
    };
    return map[body] ?? null;
};

@Injectable()
export class ListingsService {
    private readonly logger = new Logger(ListingsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sellersService: SellersService,
        private readonly config: ConfigService,
        private readonly scraper: ScraperService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { }

    /**
     * CarMazium's first-party vehicle valuation.
     *
     * This intentionally does NOT read market_price_data. That table contains
     * legacy mock-scraper rows with example source URLs from an earlier
     * experiment and must not be presented to customers as real market data.
     *
     * Instead we use CarMazium's own completed sales, accepted offers, auction
     * outcomes and live classified asking prices. When the marketplace has too
     * little evidence for a particular make/model, the pure valuation engine
     * returns an explicitly LOW-confidence age/mileage profile estimate.
     */
    async estimateVehicleValue(dto: VehicleValuationDto) {
        const make = dto.make.trim();
        const model = dto.model.trim();
        const mileageFloor = Math.max(0, dto.mileage - 50_000);
        const mileageCeiling = dto.mileage + 50_000;

        const select = {
            id: true,
            type: true,
            status: true,
            price: true,
            make: true,
            model: true,
            variant: true,
            year: true,
            mileage: true,
            fuelType: true,
            transmission: true,
            writeOffCategory: true,
            condition: true,
            serviceHistory: true,
            owners: true,
            isImported: true,
            sale: {
                select: {
                    soldPrice: true,
                    createdAt: true,
                },
            },
            auction: {
                select: {
                    status: true,
                    winningBidAmount: true,
                    updatedAt: true,
                },
            },
            offers: {
                where: { status: 'ACCEPTED' as const },
                orderBy: { updatedAt: 'desc' as const },
                take: 1,
                select: {
                    amount: true,
                    finalAmount: true,
                    updatedAt: true,
                },
            },
        } as const;

        let rows = await this.prisma.listing.findMany({
            where: {
                deletedAt: null,
                vehicleType: 'CAR',
                ...(dto.excludeListingId ? { id: { not: dto.excludeListingId } } : {}),
                make: { equals: make, mode: 'insensitive' },
                model: { equals: model, mode: 'insensitive' },
                year: { gte: dto.year - 3, lte: dto.year + 3 },
                status: { in: ['ACTIVE', 'OFFER_ACCEPTED', 'SOLD'] },
                OR: [
                    { mileage: null },
                    { mileage: { gte: mileageFloor, lte: mileageCeiling } },
                ],
            },
            select,
            orderBy: { updatedAt: 'desc' },
            take: 100,
        });

        // Sparse marketplace: widen only the year/mileage window while keeping
        // make + model exact. Comparing a Fiesta with an Explorer merely because
        // both are Fords would create misleading precision.
        if (rows.length < 4) {
            rows = await this.prisma.listing.findMany({
                where: {
                    deletedAt: null,
                    vehicleType: 'CAR',
                    ...(dto.excludeListingId ? { id: { not: dto.excludeListingId } } : {}),
                    make: { equals: make, mode: 'insensitive' },
                    model: { equals: model, mode: 'insensitive' },
                    year: { gte: dto.year - 8, lte: dto.year + 8 },
                    status: { in: ['ACTIVE', 'OFFER_ACCEPTED', 'SOLD'] },
                },
                select,
                orderBy: { updatedAt: 'desc' },
                take: 120,
            });
        }

        const comparables: VehicleValuationComparable[] = [];

        for (const row of rows) {
            const common = {
                year: row.year,
                mileage: row.mileage,
                variant: row.variant,
                fuelType: row.fuelType ? String(row.fuelType) : null,
                transmission: row.transmission ? String(row.transmission) : null,
                writeOffCategory: row.writeOffCategory ? String(row.writeOffCategory) : null,
                condition: row.condition ? String(row.condition) : null,
                serviceHistory: row.serviceHistory ? String(row.serviceHistory) : null,
                owners: row.owners != null ? String(row.owners) : null,
                isImported: row.isImported,
            };

            // Auction outcome is the strongest evidence for an auction listing.
            // Prefer it over Sale.soldPrice on the same listing to avoid counting
            // one transaction twice.
            if (row.type === 'AUCTION' && row.auction?.winningBidAmount != null) {
                comparables.push({
                    ...common,
                    price: Number(row.auction.winningBidAmount),
                    kind: 'AUCTION_RESULT',
                });
                continue;
            }

            // Prefer an accepted negotiated price over Sale.soldPrice. The
            // generic "mark sold" path historically records the advert asking
            // price when no explicit sold price was supplied, whereas an
            // accepted offer is a directly observed agreed price.
            const acceptedOffer = row.offers?.[0];
            if (acceptedOffer) {
                comparables.push({
                    ...common,
                    price: Number(acceptedOffer.finalAmount ?? acceptedOffer.amount),
                    kind: 'ACCEPTED_OFFER',
                });
                continue;
            }

            if (row.sale?.soldPrice != null) {
                comparables.push({
                    ...common,
                    price: Number(row.sale.soldPrice),
                    kind: 'SALE',
                });
                continue;
            }

            // Asking prices are useful for early-market context but deliberately
            // carry much less statistical weight than an actual transaction.
            if (row.type === 'CLASSIFIED' && row.status === 'ACTIVE') {
                comparables.push({
                    ...common,
                    price: Number(row.price),
                    kind: 'ACTIVE_ASK',
                });
            }
        }

        return calculateVehicleValuation(
            {
                make,
                model,
                year: dto.year,
                mileage: dto.mileage,
                variant: dto.variant,
                fuelType: dto.fuelType,
                transmission: dto.transmission,
                condition: dto.condition,
                serviceHistory: dto.serviceHistory,
                owners: dto.owners,
                writeOffCategory: dto.writeOffCategory,
                isImported: dto.isImported,
            },
            comparables,
        );
    }

    /**
     * Notify a seller in-app + by email that their listing was submitted and is
     * awaiting admin review. Best-effort — failures here must never block the
     * status transition that triggered them.
     */
    private async notifySubmittedForReview(listing: { id: string; title: string; sellerId?: string | null }) {
        if (!listing.sellerId) return;
        try {
            const seller = await this.prisma.user.findUnique({
                where: { id: listing.sellerId },
                select: { email: true, firstName: true },
            });
            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'LISTING_SUBMITTED',
                title: 'Listing Submitted for Review',
                message: `"${listing.title}" has been submitted and is awaiting admin review before it goes live.`,
                link: '/dashboard/seller/listings',
                entityType: 'Listing',
                entityId: listing.id,
                actionType: 'SUBMITTED',
            }).catch(() => null);
            if (notification) {
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            }
        } catch {
            // best-effort only
        }
    }

    /**
     * Generate a URL-friendly slug from title + short UUID
     * Example: "Audi Q7 2015" -> "audi-q7-2015-x8d2"
     */
    private generateSlug(title: string): string {
        const baseSlug = title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special chars
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-'); // Replace multiple hyphens with single

        const uniqueSuffix = randomBytes(2).toString('hex'); // 4 char hex
        return `${baseSlug}-${uniqueSuffix}`;
    }

    private normalizeVrm(vrm: string | null | undefined): string {
        return (vrm ?? '').replace(/\s+/g, '').trim().toUpperCase();
    }

    /**
     * Serialize listing creation for one seller + normalized VRM across every
     * backend instance. The existing pre-create lookup alone is race-prone:
     * two requests can both observe "no listing" before either insert commits.
     */
    private async lockVehicleCreation(
        tx: any,
        userId: string,
        normalizedVrm: string,
    ): Promise<void> {
        // pg_advisory_xact_lock() returns PostgreSQL `void`. Prisma cannot
        // deserialize a raw-query column of type void and turns an otherwise
        // successful lock into a 500. Cast the lock result to text so Prisma
        // receives a supported scalar while the transaction-scoped lock keeps
        // exactly the same semantics.
        await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
                hashtext(${userId}),
                hashtext(${normalizedVrm})
            )::text AS lock_result
        `;
    }

    private async findCurrentListingsForVrm(
        db: any,
        userId: string,
        normalizedVrm: string,
    ): Promise<Array<{
        id: string;
        vrm: string | null;
        type: ListingType;
        status: ListingStatus;
        title: string;
        price: any;
        year: number | null;
        mileage: number | null;
        linkedListingId: string | null;
        importedFromUrl: string | null;
    }>> {
        const candidates = await db.listing.findMany({
            where: {
                sellerId: userId,
                deletedAt: null,
                status: { not: 'SOLD' },
            },
            select: {
                id: true,
                vrm: true,
                type: true,
                status: true,
                title: true,
                price: true,
                year: true,
                mileage: true,
                linkedListingId: true,
                importedFromUrl: true,
            },
            orderBy: { updatedAt: 'desc' },
        });

        return candidates.filter(
            (candidate: { vrm: string | null }) => this.normalizeVrm(candidate.vrm) === normalizedVrm,
        );
    }

    /**
     * Resolve an existing same-vehicle row while holding the seller+VRM lock.
     * Only an exact retry signature is idempotently reused. A different draft
     * is surfaced as a conflict so fresh input can never be silently replaced
     * by stale listing data.
     */
    private async resolveExistingCreate(
        db: any,
        userId: string,
        normalizedVrm: string,
        requested: {
            type: ListingType;
            title: string;
            price: number;
            year?: number | null;
            mileage?: number | null;
            importedFromUrl?: string | null;
        },
    ): Promise<Listing | null> {
        const matches = await this.findCurrentListingsForVrm(db, userId, normalizedVrm);
        if (matches.length === 0) return null;

        const reusable = matches.find((candidate) =>
            candidate.type === requested.type
            && ['DRAFT', 'REJECTED'].includes(candidate.status)
            && !candidate.linkedListingId
            && candidate.title.trim() === requested.title.trim()
            && Number(candidate.price) === Number(requested.price)
            && (requested.year === undefined || candidate.year === requested.year)
            && (requested.mileage === undefined || candidate.mileage === requested.mileage)
            && (
                requested.importedFromUrl === undefined
                || candidate.importedFromUrl === requested.importedFromUrl
            )
        );

        if (reusable) {
            return db.listing.findUnique({ where: { id: reusable.id } });
        }

        const existing = matches[0];
        throw new BadRequestException(
            `This vehicle already has an existing ${existing.type.toLowerCase()} listing (${existing.status.toLowerCase()}). Open that listing instead of creating a duplicate.`,
        );
    }

    private assertListingImageUrls(imageUrls: string[], userId?: string): void {
        if (imageUrls.length > 100) {
            throw new BadRequestException('A maximum of 100 listing photos is allowed');
        }

        const supabaseBase = this.config.get<string>('SUPABASE_URL')
            || this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        if (!supabaseBase) {
            throw new BadRequestException('Vehicle photo storage is not configured');
        }

        let allowedOrigin = '';
        try {
            allowedOrigin = new URL(supabaseBase).origin;
        } catch {
            throw new BadRequestException('Vehicle photo storage is not configured');
        }

        const prefix = '/storage/v1/object/public/listings/';
        const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        for (const value of imageUrls) {
            const clean = value?.split('#')[0] ?? '';
            let parsed: URL;
            try {
                parsed = new URL(clean);
            } catch {
                throw new BadRequestException('Every listing photo must be a valid CarMazium storage URL');
            }

            if (parsed.protocol !== 'https:' || parsed.origin !== allowedOrigin || !parsed.pathname.startsWith(prefix)) {
                throw new BadRequestException('Only CarMazium listing photos may be attached to a listing');
            }

            const objectKey = decodeURIComponent(parsed.pathname.slice(prefix.length));
            if (!objectKey || objectKey.includes('..')) {
                throw new BadRequestException('Invalid listing photo path');
            }

            const firstSegment = objectKey.split('/')[0];
            if (userId && uuidLike.test(firstSegment) && firstSegment !== userId) {
                throw new ForbiddenException('The listing contains a photo outside your upload area');
            }
        }
    }

    private getImportImageAllowedHosts(): string[] {
        return (this.config.get<string>('IMPORT_IMAGE_HOST_ALLOWLIST') ?? '')
            .split(',')
            .map((host) => host.trim().toLowerCase())
            .filter(Boolean);
    }

    /**
     * Download one image from a supported marketplace through the hardened
     * importer and write it into the seller's CarMazium-owned Storage namespace.
     *
     * External URLs are never returned as a fallback: callers either receive a
     * CarMazium Storage URL or null.
     */
    private async rehostImportedImage(
        url: string,
        userId: string,
        platform: ImportedListingPlatform,
    ): Promise<string | null> {
        const supabaseUrl = this.config.get<string>('SUPABASE_URL')
            || this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
            || this.config.get<string>('SUPABASE_SERVICE_KEY');

        // Do not fetch remote content if we cannot safely persist it afterward.
        if (!supabaseUrl || !serviceRoleKey) {
            this.logger.warn('Skipping imported image: secure Storage credentials are not configured');
            return null;
        }

        try {
            const downloaded = await downloadExternalImage(url, platform, {
                maxBytes: 8 * 1024 * 1024,
                timeoutMs: 8_000,
                maxRedirects: 3,
                extraAllowedHosts: this.getImportImageAllowedHosts(),
            });

            const storage = createClient(supabaseUrl, serviceRoleKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });

            const objectPath = `${userId}/vehicle/import-${randomUUID()}.${downloaded.extension}`;
            const { error } = await storage.storage
                .from('listings')
                .upload(objectPath, downloaded.buffer, {
                    contentType: downloaded.mimeType,
                    upsert: false,
                });

            if (error) throw error;

            return storage.storage.from('listings').getPublicUrl(objectPath).data.publicUrl;
        } catch (error: any) {
            this.logger.warn(`Rejected/failed imported image ${url}: ${error?.message || error}`);
            return null;
        }
    }

    /**
     * Keep import memory/connections bounded. At most three external images are
     * downloaded at once, each with its own byte and time limit.
     */
    private async rehostImportedImages(
        urls: string[],
        userId: string,
        platform: ImportedListingPlatform,
    ): Promise<string[]> {
        const inputs = [...new Set(urls.filter(Boolean))].slice(0, 20);
        if (inputs.length === 0) return [];

        const results: Array<string | null> = new Array(inputs.length).fill(null);
        let cursor = 0;

        const worker = async () => {
            while (true) {
                const index = cursor++;
                if (index >= inputs.length) return;
                results[index] = await this.rehostImportedImage(inputs[index], userId, platform);
            }
        };

        await Promise.all(
            Array.from({ length: Math.min(3, inputs.length) }, () => worker()),
        );

        return results.filter((value): value is string => Boolean(value));
    }

    /**
     * Geocode a UK location string to lat/lng via OpenStreetMap Nominatim.
     * Returns null silently on any failure — never blocks listing creation.
     */
    private async geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&countrycodes=gb&format=json&limit=1`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Carmazium/1.0 (contact@carmazium.com)' },
                signal: AbortSignal.timeout(5000),
            });
            const data = await res.json();
            if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch { /* silent */ }
        return null;
    }

    /**
     * Create a new listing
     * Auto-generates slug and saves Supabase image URLs
     */
    async create(createListingDto: CreateListingDto, userId?: string): Promise<Listing> {
        const slug = this.generateSlug(createListingDto.title);
        const normalizedVrm = this.normalizeVrm(createListingDto.vrm);
        const originalImages = createListingDto.images ?? [];

        this.assertListingImageUrls(originalImages, userId);

        const listingType: ListingType = createListingDto.listingType === 'AUCTION' ? 'AUCTION' : 'CLASSIFIED';

        const hasInitialAuctionSchedule = [
            createListingDto.auctionStartTime,
            createListingDto.auctionReservePrice,
            createListingDto.auctionMinIncrement,
            createListingDto.auctionBuyItNowPrice,
            createListingDto.auctionStartingBid,
        ].some((value) => value !== undefined);

        if (listingType !== 'AUCTION' && hasInitialAuctionSchedule) {
            throw new BadRequestException('Auction schedule fields are only valid for AUCTION listings');
        }

        let initialAuctionCreate: {
            startTime: Date;
            endTime: Date;
            reservePrice: number;
            startingBid: number;
            minIncrement: number;
            buyItNowPrice: number | null;
            status: 'SCHEDULED';
        } | null = null;

        if (listingType === 'AUCTION' && hasInitialAuctionSchedule) {
            if (
                !createListingDto.auctionStartTime
                || createListingDto.auctionReservePrice === undefined
                || createListingDto.auctionMinIncrement === undefined
            ) {
                throw new BadRequestException(
                    'Initial auction creation requires start time, reserve price and minimum increment together',
                );
            }

            if (originalImages.length < 10) {
                throw new BadRequestException(
                    `Auctions require at least 10 photos before scheduling. You have ${originalImages.length}.`,
                );
            }

            const now = new Date();
            const startTime = new Date(createListingDto.auctionStartTime);
            if (
                Number.isNaN(startTime.getTime())
                || startTime.getTime() < now.getTime() - 60 * 1000
            ) {
                throw new BadRequestException('Start time cannot be in the past');
            }

            const marketValue = Number(createListingDto.price);
            if (!Number.isFinite(marketValue) || marketValue <= 0) {
                throw new BadRequestException(
                    'A valid Estimated Market Value is required before this vehicle can be auctioned',
                );
            }

            initialAuctionCreate = {
                startTime,
                endTime: new Date(startTime.getTime() + AUCTION_DURATION_MS),
                reservePrice: createListingDto.auctionReservePrice,
                startingBid: calculatePlatformOpeningBid(marketValue),
                minIncrement: createListingDto.auctionMinIncrement,
                buyItNowPrice: createListingDto.auctionBuyItNowPrice ?? null,
                status: 'SCHEDULED',
            };
        }

        // Public pricing has exactly two listing products: free Auction and
        // £1 Retail. Never trust a client-supplied legacy STANDARD/PREMIUM tier.
        const badgeTier = listingType === 'AUCTION' ? 'FREE' : 'BASIC';

        // Every new listing must pass admin review before it can go live — nothing
        // is ever created directly as ACTIVE. Retail paid tiers start DRAFT and
        // auctions also always start DRAFT, even when their Auction row is created
        // atomically. publishListing() owns the listing-completeness review gate.
        // HPI is optional and never participates in submission readiness.
        const listingStatus: ListingStatus = listingType === 'AUCTION'
            ? 'DRAFT'
            : createListingDto.status === 'DRAFT'
                ? 'DRAFT'
                : badgeTier !== 'FREE'
                    ? 'DRAFT'
                    : 'PENDING_REVIEW';

        // Cat A and Cat B are total-loss / body-salvage write-offs that cannot be
        // re-registered. They may only be listed for auction (parts/scrapping).
        const writeOff = createListingDto.writeOffCategory;
        if ((writeOff === 'CAT_A' || writeOff === 'CAT_B') && listingType === 'CLASSIFIED') {
            throw new BadRequestException(
                'Cat A and Cat B write-offs cannot be listed for retail sale. Switch to an Auction listing to proceed.',
            );
        }

        // Create under a seller+VRM transaction lock. This makes retries safe
        // across multiple Fly instances instead of relying on a race-prone
        // pre-insert lookup.
        const createResult = await this.prisma.$transaction(async (tx) => {
            if (userId && normalizedVrm) {
                await this.lockVehicleCreation(tx, userId, normalizedVrm);
                const existing = await this.resolveExistingCreate(
                    tx,
                    userId,
                    normalizedVrm,
                    {
                        type: listingType,
                        title: createListingDto.title,
                        price: createListingDto.price,
                        year: createListingDto.year,
                        mileage: createListingDto.mileage,
                    },
                );
                if (existing) {
                    return { listing: existing, created: false };
                }
            }

            const created = await tx.listing.create({
                data: {
                title: createListingDto.title,
                price: createListingDto.price,
                priceMin: createListingDto.priceMin ?? null,
                priceMax: createListingDto.priceMax ?? null,
                images: originalImages,
                videoUrls: createListingDto.videoUrls ?? [],
                type: listingType,
                status: listingStatus,
                description: createListingDto.description ?? null,
                slug,
                // Vehicle identity
                make: createListingDto.make ?? null,
                model: createListingDto.model ?? null,
                year: createListingDto.year,
                mileage: createListingDto.mileage,
                vrm: normalizedVrm || null,
                vin: createListingDto.vin ?? null,
                // Technical specs
                fuelType: mapFuelType(createListingDto.fuelType),
                transmission: mapTransmission(createListingDto.transmission),
                color: createListingDto.color ?? null,
                doors: createListingDto.doors ?? null,
                seats: createListingDto.seats ?? null,
                engineSize: createListingDto.engineSize ?? null,
                bhp: createListingDto.bhp ?? null,
                bodyType: mapBodyType(createListingDto.bodyType),
                features: createListingDto.features ?? undefined,
                location: createListingDto.location ?? null,
                // Phase 3: condition & UK compliance
                condition: createListingDto.condition ?? null,
                ulezCompliant: createListingDto.ulezCompliant ?? null,
                euroStandard: createListingDto.euroStandard ?? null,
                // Phase 4: CO2 emissions (from DVLA)
                co2Emissions: createListingDto.co2Emissions ?? null,
                // DVLA extended fields
                motStatus: createListingDto.motStatus ?? null,
                taxStatus: createListingDto.taxStatus ?? null,
                motExpiryDate: createListingDto.motExpiryDate ?? null,
                taxDueDate: createListingDto.taxDueDate ?? null,
                markedForExport: createListingDto.markedForExport ?? null,
                monthOfFirstRegistration: createListingDto.monthOfFirstRegistration ?? null,
                wheelplan: createListingDto.wheelplan ?? null,
                typeApproval: createListingDto.typeApproval ?? null,
                // Pricing marker only: FREE for Auction, BASIC for £1 Retail.
                // Featured placement is now a separate optional add-on.
                badgeTier,
                isFeatured: false,
                featuredUntil: null,
                // Seller
                sellerId: userId ?? null,
                // Vehicle type & import status
                vehicleType: createListingDto.vehicleType ?? 'CAR',
                isImported: createListingDto.isImported ?? false,
                // Legal declarations
                stolenRecovered: createListingDto.stolenRecovered ?? null,
                hasOutstandingFinance: createListingDto.hasOutstandingFinance ?? null,
                isLegalRegisteredKeeper: createListingDto.isLegalRegisteredKeeper ?? null,
                writeOffCategory: createListingDto.writeOffCategory ?? 'NONE',
                // Extended vehicle details
                variant: createListingDto.variant ?? null,
                driveType: createListingDto.driveType ?? null,
                numberOfKeys: createListingDto.numberOfKeys ?? null,
                serviceHistory: createListingDto.serviceHistory ?? null,
                owners: createListingDto.owners ?? null,
                torqueNm: createListingDto.torqueNm ?? null,
                topSpeedMph: createListingDto.topSpeedMph ?? null,
                zeroTo60Mph: createListingDto.zeroTo60Mph ?? null,
                combinedMpg: createListingDto.combinedMpg ?? null,
                extraUrbanMpg: createListingDto.extraUrbanMpg ?? null,
                // Exterior grade is never seller-set — it's computed automatically from
                // marked damage zones (see DamageAnalysisService.saveDamageRecords). A
                // fresh listing with no damage reported yet starts at the best grade.
                exteriorGrade: 1,
                bannerLabel: createListingDto.bannerLabel ?? null,
                // Phase 13: departed/estate sale
                isDepartedSale: createListingDto.isDepartedSale ?? false,
                departedRelationship: createListingDto.departedRelationship ?? null,
                notOwnerRelationship: createListingDto.notOwnerRelationship ?? null,
                // Phase 15: delivery options
                deliveryAvailable: createListingDto.deliveryAvailable ?? false,
                deliveryPricePerMile: createListingDto.deliveryPricePerMile ?? null,
                deliveryMaxMiles: createListingDto.deliveryMaxMiles ?? null,
            },
            });

            // Keep initial auction creation atomic, but create the Auction row
            // explicitly inside this same transaction rather than relying on a
            // nested relation write. This is easier to diagnose in production
            // and uses the same proven create path as AuctionsService.
            if (initialAuctionCreate) {
                await tx.auction.create({
                    data: {
                        listingId: created.id,
                        ...initialAuctionCreate,
                    },
                });
            }

            return { listing: created, created: true };
        });

        const listing = createResult.listing;
        if (!createResult.created) {
            return listing;
        }

        // Geocode location in background — non-blocking
        if (createListingDto.location) {
            this.geocodeLocation(createListingDto.location)
                .then(coords => {
                    if (coords) return this.prisma.listing.update({
                        where: { id: listing.id },
                        data: { latitude: coords.lat, longitude: coords.lng },
                    });
                })
                .catch(() => { /* silent */ });
        }

        // A create() call alone never submits an auction for review. Auctions are
        // DRAFT until publishListing() passes readiness/HPI checks. This branch is
        // retained for any non-auction create flow that legitimately starts in
        // PENDING_REVIEW.
        if (listingStatus === 'PENDING_REVIEW') {
            this.notifySubmittedForReview({ id: listing.id, title: listing.title, sellerId: userId ?? listing.sellerId }).catch(() => { });
        }

        return listing;
    }

    /**
     * Find all listings with filtering and pagination
     * Automatically excludes soft-deleted items
     */
    async findAll(filterDto: ListingFilterDto): Promise<{ data: Listing[]; total: number }> {
        const {
            minPrice, maxPrice,
            make, model,
            minYear, maxYear, year,  // year is deprecated alias for minYear
            minMileage, maxMileage,
            fuelType, fuelTypes, transmission, transmissions, bodyType,
            color, minDoors, minSeats,
            minEngine, maxEngine, maxCo2,
            conditions, ulezCompliant, euroStandard,
            isImported, markedForExport,
            vehicleType,
            minBhp, maxBhp,
            sellerType, location, listingType,
            sortBy, search, features,
            page = 1, limit = 20,
        } = filterDto;
        const where: any = { deletedAt: null, status: { in: ['ACTIVE', 'SOLD', 'OFFER_ACCEPTED'] } };

        // ─── Price range ────────────────────────────────────────────────────
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.price = {};
            if (minPrice !== undefined) where.price.gte = minPrice;
            if (maxPrice !== undefined) where.price.lte = maxPrice;
        }

        // ─── Make / Model ───────────────────────────────────────────────────
        if (make) where.make = { contains: make, mode: 'insensitive' };
        if (model) where.model = { contains: model, mode: 'insensitive' };

        // ─── Year range ─────────────────────────────────────────────────────
        const effectiveMinYear = minYear ?? year; // backwards-compat alias
        if (effectiveMinYear !== undefined || maxYear !== undefined) {
            where.year = {};
            if (effectiveMinYear !== undefined) where.year.gte = effectiveMinYear;
            if (maxYear !== undefined) where.year.lte = maxYear;
        }

        // ─── Mileage range ──────────────────────────────────────────────────
        if (minMileage !== undefined || maxMileage !== undefined) {
            where.mileage = {};
            if (minMileage !== undefined) where.mileage.gte = minMileage;
            if (maxMileage !== undefined) where.mileage.lte = maxMileage;
        }

        // ─── Enum filters ───────────────────────────────────────────────────
        // fuelTypes (array) takes precedence over single fuelType for multi-select support
        if (fuelTypes?.length) where.fuelType = { in: fuelTypes };
        else if (fuelType) where.fuelType = fuelType;
        if (transmissions?.length) where.transmission = { in: transmissions };
        else if (transmission) where.transmission = transmission;
        if (bodyType) where.bodyType = bodyType;
        if (conditions?.length) where.condition = { in: conditions };
        if (euroStandard) where.euroStandard = euroStandard;
        if (vehicleType) where.vehicleType = vehicleType;

        // ─── Features (JSON array contains) ─────────────────────────────────
        // Filter listings where the JSON features array contains ALL requested features
        if (features?.length) where.features = { array_contains: features };

        // ─── Colour (case-insensitive) ──────────────────────────────────────
        if (color) where.color = { contains: color, mode: 'insensitive' };

        // ─── Door / Seat minimums ────────────────────────────────────────────
        if (minDoors !== undefined) where.doors = { gte: minDoors };
        if (minSeats !== undefined) where.seats = { gte: minSeats };

        // ─── Engine capacity (cc) ────────────────────────────────────────────
        if (minEngine !== undefined || maxEngine !== undefined) {
            where.engineCapacity = {};
            if (minEngine !== undefined) where.engineCapacity.gte = minEngine;
            if (maxEngine !== undefined) where.engineCapacity.lte = maxEngine;
        }

        // ─── CO₂ ceiling ─────────────────────────────────────────────────────
        if (maxCo2 !== undefined) where.co2Emissions = { lte: maxCo2 };

        // ─── Boolean compliance filter ───────────────────────────────────────
        if (ulezCompliant !== undefined) where.ulezCompliant = ulezCompliant;

        // ─── Imported / Export status ────────────────────────────────────────
        if (isImported !== undefined) where.isImported = isImported;
        if (markedForExport !== undefined) where.markedForExport = markedForExport;

        // ─── Delivery availability ────────────────────────────────────────────
        if (filterDto.deliveryAvailable !== undefined) {
            where.deliveryAvailable = filterDto.deliveryAvailable;
        }

        // ─── BHP / Power range ───────────────────────────────────────────────
        if (minBhp !== undefined || maxBhp !== undefined) {
            where.bhp = {};
            if (minBhp !== undefined) where.bhp.gte = minBhp;
            if (maxBhp !== undefined) where.bhp.lte = maxBhp;
        }

        // ─── Seller type ─────────────────────────────────────────────────────
        if (sellerType === 'DEALER') {
            where.seller = { role: 'DEALER' };
        } else if (sellerType === 'PRIVATE') {
            where.seller = { role: { in: ['BUYER', 'SELLER'] } };
        }

        // ─── Location text search ────────────────────────────────────────────
        if (location) where.location = { contains: location, mode: 'insensitive' };

        // ─── Listing type ────────────────────────────────────────────────────
        // Auction listings must never appear in the public retail search.
        // They live exclusively in /auctions. Only return CLASSIFIED listings
        // unless the caller explicitly requests AUCTION type.
        if (listingType) {
            where.type = listingType;
        } else {
            where.type = 'CLASSIFIED';
        }

        // ─── Full-text search ────────────────────────────────────────────────
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { make: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
            ];
        }

        // ─── Sort ────────────────────────────────────────────────────────────
        // Active listings always appear before SOLD ones (status: 'asc' puts ACTIVE before SOLD).
        // Featured listings appear first, then the selected sort.
        let orderBy: any[] = [{ status: 'asc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }];
        if (sortBy === 'price_asc') orderBy = [{ status: 'asc' }, { isFeatured: 'desc' }, { price: 'asc' }];
        else if (sortBy === 'price_desc') orderBy = [{ status: 'asc' }, { isFeatured: 'desc' }, { price: 'desc' }];
        else if (sortBy === 'mileage_asc') orderBy = [{ status: 'asc' }, { isFeatured: 'desc' }, { mileage: 'asc' }];
        else if (sortBy === 'mileage_desc') orderBy = [{ status: 'asc' }, { isFeatured: 'desc' }, { mileage: 'desc' }];
        else if (sortBy === 'year_desc') orderBy = [{ status: 'asc' }, { isFeatured: 'desc' }, { year: 'desc' }];
        else if (sortBy === 'year_asc') orderBy = [{ status: 'asc' }, { isFeatured: 'desc' }, { year: 'asc' }];

        const skip = (page - 1) * limit;

        // Execute query with count
        const [data, total] = await Promise.all([
            this.prisma.listing.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    seller: {
                        select: {
                            id: true,
                            role: true,
                            firstName: true,
                            lastName: true,
                            sellerProfile: {
                                select: {
                                    reliabilityScore: true
                                }
                            }
                        }
                    },
                    // A result row carries `type: 'AUCTION'` but previously nothing
                    // that identified *which* auction, so no client could route an
                    // auction result to its auction — mobile opened every result in
                    // the retail detail screen, and web links every result to
                    // /buy-cars/[slug] for the same reason (BUY-017). There is no
                    // by-listing auction endpoint to look it up with either.
                    // Scalars only, no bids, so this adds one join and no N+1.
                    auction: {
                        select: { id: true, status: true, endTime: true },
                    },
                }
            }),
            this.prisma.listing.count({ where }),
        ]);

        // Admin-created listings are presented as CarMazium's own rather than
        // under the staff member's personal name — see admin-seller-branding.ts.
        // priceMin/priceMax are seller-private negotiation controls and must
        // never be exposed by public marketplace search responses.
        const publicData = data.map((row: any) => {
            const { priceMin: _priceMin, priceMax: _priceMax, ...safe } = row;
            return brandListingSeller(safe);
        });
        return { data: publicData as Listing[], total };
    }

    /**
     * Get currently featured listings (isFeatured = true, not expired)
     * Used for homepage carousel and "Featured" sections
     */
    async getFeaturedListings(limit = 8): Promise<Listing[]> {
        const listings = await this.prisma.listing.findMany({
            where: {
                deletedAt: null,
                status: 'ACTIVE',
                type: 'CLASSIFIED', // Auction listings never appear in featured retail sections
                isFeatured: true,
                featuredUntil: { gt: new Date() },
            },
            orderBy: { featuredUntil: 'desc' },
            take: limit,
            include: {
                seller: {
                    select: {
                        id: true,
                        role: true,
                        firstName: true,
                        lastName: true,
                        sellerProfile: {
                            select: { reliabilityScore: true },
                        },
                    },
                },
                hpiReport: {
                    select: { isClear: true }
                },
            },
        });
        return listings.map((row: any) => {
            const { priceMin: _priceMin, priceMax: _priceMax, ...safe } = row;
            return safe as Listing;
        });
    }

    /**
     * Find a single listing by slug (SEO-friendly) or ID.
     * `viewerId` is only present when the caller is authenticated (via
     * OptionalSessionAuthGuard) — used to gate the seller's phone number so
     * anonymous visitors never receive it in the response payload.
     */
    async findBySlug(slugOrId: string, viewerId?: string): Promise<Listing> {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slugOrId);

        const listing = await this.prisma.listing.findFirst({
            where: {
                ...(isUuid ? { id: slugOrId } : { slug: slugOrId }),
                deletedAt: null,
            },
            include: {
                seller: {
                    // NOTE: explicit `select` (not `include`) — this is a public
                    // endpoint and must never leak passwordHash or other
                    // sensitive User columns to anonymous callers.
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true,
                        role: true,
                        phone: true,
                        createdAt: true,
                        sellerProfile: {
                            include: {
                                reviews: {
                                    take: 5,
                                    orderBy: { createdAt: 'desc' },
                                    include: {
                                        reviewer: {
                                            select: {
                                                firstName: true,
                                                lastName: true,
                                                profileImage: true
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        dealerProfile: true,
                        _count: {
                            select: {
                                listings: {
                                    where: { status: 'ACTIVE', deletedAt: null }
                                }
                            }
                        }
                    }
                },
                hpiReport: {
                    // `status` lets the buyer-facing page only show the "View
                    // Report" entry point once one has actually been requested
                    // — without it every listing showed the button regardless
                    // of whether the seller ever paid for a report at all.
                    select: { status: true, isClear: true, purchasedAt: true }
                },
                damageRecords: {
                    orderBy: { createdAt: 'asc' },
                },
                // This listing's own auction (not to be confused with linkedListing.auction
                // below, which is a *different* listing's auction for dual-channel cross-
                // linking) — needed for the auction-buyer-fee checkout page (winning bid,
                // auction reference).
                auction: {
                    select: {
                        id: true,
                        status: true,
                        reservePrice: true,
                        startingBid: true,
                        minIncrement: true,
                        startTime: true,
                        endTime: true,
                        winnerId: true,
                        winningBidAmount: true,
                        buyItNowPrice: true,
                        buyItNowPendingBuyerId: true,
                    },
                },
                linkedListing: {
                    select: {
                        id: true,
                        type: true,
                        auction: {
                            select: { id: true, status: true, endTime: true },
                        },
                    },
                },
            }
        });

        if (!listing) {
            throw new NotFoundException(`Listing with slug/id "${slugOrId}" not found`);
        }

        // Fire-and-forget strictly incrementing the viewCount logic
        this.prisma.listing.update({
            where: { id: listing.id },
            data: { viewCount: { increment: 1 } },
        }).catch(err => console.error(`Failed to increment views for ${slugOrId}:`, err));

        // Map _count to listingCount on seller
        let sellerWithCount: any = listing.seller
            ? { ...listing.seller, listingCount: (listing.seller as any)._count?.listings ?? 0 }
            : listing.seller

        // Gate contact phone numbers behind login — anonymous visitors get a
        // `phoneAvailable` boolean instead of the real number so the frontend
        // can render a "log in to view" blurred placeholder.
        if (sellerWithCount) {
            const hasPersonalPhone = !!sellerWithCount.phone;
            const hasDealerPhone = !!sellerWithCount.dealerProfile?.phone;

            sellerWithCount = {
                ...sellerWithCount,
                phone: viewerId ? sellerWithCount.phone : null,
                phoneAvailable: hasPersonalPhone,
                ...(sellerWithCount.dealerProfile ? {
                    dealerProfile: {
                        ...sellerWithCount.dealerProfile,
                        phone: viewerId ? sellerWithCount.dealerProfile.phone : null,
                        phoneAvailable: hasDealerPhone,
                    },
                } : {}),
            };
        }

        const listingWithCount: any = {
            ...listing,
            seller: brandAdminSeller(sellerWithCount as any),
        };

        if (!viewerId || viewerId !== listing.sellerId) {
            delete listingWithCount.priceMin;
            delete listingWithCount.priceMax;
        }

        return listingWithCount as any;
    }

    /**
     * Find a single listing by ID (for updates/deletes)
     */
    async findById(id: string): Promise<Listing> {
        const listing = await this.prisma.listing.findUnique({
            where: { id },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException(`Listing with ID "${id}" not found`);
        }

        return listing;
    }

    /**
     * Update a listing
     * Includes ownership check - only the seller can update
     */
    async update(
        id: string,
        userId: string,
        updateListingDto: UpdateListingDto,
    ): Promise<Listing> {
        // First, fetch the listing to verify ownership
        const listing = await this.findById(id);

        // Ownership check (skip if no sellerId - for development)
        if (listing.sellerId && listing.sellerId !== userId) {
            throw new ForbiddenException('You do not have permission to update this listing');
        }

        // Build update data with proper type mapping
        const updateData: any = {};

        if (updateListingDto.title) updateData.title = updateListingDto.title;
        if (updateListingDto.price) updateData.price = updateListingDto.price;
        if (updateListingDto.priceMin !== undefined) updateData.priceMin = updateListingDto.priceMin ?? null;
        if (updateListingDto.priceMax !== undefined) updateData.priceMax = updateListingDto.priceMax ?? null;
        if (updateListingDto.description !== undefined) updateData.description = updateListingDto.description;
        if (updateListingDto.images) updateData.images = updateListingDto.images;
        if (updateListingDto.videoUrls !== undefined) updateData.videoUrls = updateListingDto.videoUrls;
        if (updateListingDto.make) updateData.make = updateListingDto.make;
        if (updateListingDto.model) updateData.model = updateListingDto.model;
        if (updateListingDto.year) updateData.year = updateListingDto.year;
        if (updateListingDto.mileage) updateData.mileage = updateListingDto.mileage;
        if (updateListingDto.vrm) updateData.vrm = updateListingDto.vrm;
        if (updateListingDto.fuelType) updateData.fuelType = mapFuelType(updateListingDto.fuelType);
        if (updateListingDto.transmission) updateData.transmission = mapTransmission(updateListingDto.transmission);
        // status, listing type and badge tier are intentionally not editable here.
        // Those fields drive payment, review and auction lifecycle rules and must
        // go through their dedicated server-side endpoints.
        // DVLA extended fields
        if (updateListingDto.motStatus !== undefined) updateData.motStatus = updateListingDto.motStatus;
        if (updateListingDto.taxStatus !== undefined) updateData.taxStatus = updateListingDto.taxStatus;
        if (updateListingDto.motExpiryDate !== undefined) updateData.motExpiryDate = updateListingDto.motExpiryDate;
        if (updateListingDto.taxDueDate !== undefined) updateData.taxDueDate = updateListingDto.taxDueDate;
        if (updateListingDto.markedForExport !== undefined) updateData.markedForExport = updateListingDto.markedForExport;
        if (updateListingDto.monthOfFirstRegistration !== undefined) updateData.monthOfFirstRegistration = updateListingDto.monthOfFirstRegistration;
        if (updateListingDto.wheelplan !== undefined) updateData.wheelplan = updateListingDto.wheelplan;
        if (updateListingDto.typeApproval !== undefined) updateData.typeApproval = updateListingDto.typeApproval;
        if (updateListingDto.stolenRecovered !== undefined) updateData.stolenRecovered = updateListingDto.stolenRecovered;
        if (updateListingDto.hasOutstandingFinance !== undefined) updateData.hasOutstandingFinance = updateListingDto.hasOutstandingFinance;
        if (updateListingDto.isLegalRegisteredKeeper !== undefined) updateData.isLegalRegisteredKeeper = updateListingDto.isLegalRegisteredKeeper;
        if (updateListingDto.writeOffCategory !== undefined) {
            // Listing type is immutable through the generic seller edit route.
            // Enforce the auction-only rule against the persisted listing type.
            if ((updateListingDto.writeOffCategory === 'CAT_A' || updateListingDto.writeOffCategory === 'CAT_B') && listing.type === 'CLASSIFIED') {
                throw new BadRequestException(
                    'Cat A and Cat B write-offs cannot be listed for retail sale. Switch to an Auction listing to proceed.',
                );
            }
            updateData.writeOffCategory = updateListingDto.writeOffCategory;
        }
        // Extended vehicle details
        if (updateListingDto.variant !== undefined) updateData.variant = updateListingDto.variant;
        if (updateListingDto.driveType !== undefined) updateData.driveType = updateListingDto.driveType;
        if (updateListingDto.numberOfKeys !== undefined) updateData.numberOfKeys = updateListingDto.numberOfKeys;
        if (updateListingDto.serviceHistory !== undefined) updateData.serviceHistory = updateListingDto.serviceHistory;
        if (updateListingDto.owners !== undefined) updateData.owners = updateListingDto.owners;
        if (updateListingDto.torqueNm !== undefined) updateData.torqueNm = updateListingDto.torqueNm;
        if (updateListingDto.topSpeedMph !== undefined) updateData.topSpeedMph = updateListingDto.topSpeedMph;
        if (updateListingDto.zeroTo60Mph !== undefined) updateData.zeroTo60Mph = updateListingDto.zeroTo60Mph;
        if (updateListingDto.combinedMpg !== undefined) updateData.combinedMpg = updateListingDto.combinedMpg;
        if (updateListingDto.extraUrbanMpg !== undefined) updateData.extraUrbanMpg = updateListingDto.extraUrbanMpg;
        // exteriorGrade is intentionally not settable here — it's computed automatically
        // from damage records (see DamageAnalysisService.saveDamageRecords).
        if (updateListingDto.bannerLabel !== undefined) updateData.bannerLabel = updateListingDto.bannerLabel;
        // Phase 13: departed/estate sale
        if (updateListingDto.isDepartedSale !== undefined) updateData.isDepartedSale = updateListingDto.isDepartedSale;
        if (updateListingDto.departedRelationship !== undefined) updateData.departedRelationship = updateListingDto.departedRelationship ?? null;
        if (updateListingDto.notOwnerRelationship !== undefined) updateData.notOwnerRelationship = updateListingDto.notOwnerRelationship ?? null;
        // Phase 15: delivery options
        if (updateListingDto.deliveryAvailable !== undefined) updateData.deliveryAvailable = updateListingDto.deliveryAvailable;
        if (updateListingDto.deliveryPricePerMile !== undefined) updateData.deliveryPricePerMile = updateListingDto.deliveryPricePerMile ?? null;
        if (updateListingDto.deliveryMaxMiles !== undefined) updateData.deliveryMaxMiles = updateListingDto.deliveryMaxMiles ?? null;

        // Update the listing
        const updatedListing = await this.prisma.listing.update({
            where: { id },
            data: updateData,
        });

        // Re-geocode if location changed
        if (updateListingDto.location && updateListingDto.location !== listing.location) {
            this.geocodeLocation(updateListingDto.location)
                .then(coords => {
                    if (coords) return this.prisma.listing.update({
                        where: { id },
                        data: { latitude: coords.lat, longitude: coords.lng },
                    });
                })
                .catch(() => { /* silent */ });
        }

        // Phase 2: If status changed to ACTIVE, increment seller's listing count
        if (updateData.status === 'ACTIVE' && updatedListing.sellerId && listing.status !== 'ACTIVE') {
            await this.sellersService.incrementListings(updatedListing.sellerId);
        }

        return updatedListing;
    }

    /**
     * Update listing status
     * Allows specific transitions (Draft -> Active -> Sold/Withdrawn)
     *
     * NOTE: When transitioning to SOLD via this endpoint we ALSO record a Sale row
     * (using listing.price as the sold price) so the earnings/dashboard metrics stay
     * consistent. Sellers wanting to record a different sold price + buyer should
     * use the dedicated `recordSale` endpoint, which is idempotent against this one.
     */
    async updateStatus(
        id: string,
        userId: string,
        status: ListingStatus,
        buyerPostcode?: string,
    ): Promise<Listing> {
        const listing = await this.findById(id);

        if (listing.sellerId && listing.sellerId !== userId) {
            // Allow active dealer staff of the listing's owner to update status as well
            const staffMember = listing.sellerId
                ? await this.prisma.dealerStaff.findFirst({
                    where: {
                        userId,
                        dealerProfile: { userId: listing.sellerId },
                        isActive: true,
                    },
                })
                : null;
            if (!staffMember) {
                throw new ForbiddenException('You do not have permission to update this listing');
            }
        }

        // Going live must always go through payment + admin review (publishListing()
        // then an admin approval) — this generic status endpoint may only relist a
        // listing that has already been through that gate once (i.e. it's currently
        // ACTIVE, SOLD, WITHDRAWN, or OFFER_ACCEPTED). It may never be used to skip
        // review for a brand-new, still-DRAFT, still-PENDING_REVIEW, or REJECTED listing.
        if (status === 'ACTIVE' && !['ACTIVE', 'SOLD', 'WITHDRAWN', 'OFFER_ACCEPTED'].includes(listing.status)) {
            throw new BadRequestException(
                'This listing has not been approved yet. Submit it for review from the listing editor instead.',
            );
        }

        // For SOLD transitions we wrap the listing update + Sale insert in a transaction
        // so total earnings can never drift from the listings.status state.
        const isNewSold = status === 'SOLD' && listing.status !== 'SOLD';
        const updated = isNewSold
            ? await this.prisma.$transaction(async (tx) => {
                const next = await tx.listing.update({
                    where: { id },
                    data: { status },
                });
                // Only insert a Sale row if one doesn't already exist for this listing
                // (defensive against double-clicks / race with `recordSale`).
                const existing = await tx.sale.findFirst({ where: { listingId: id } });
                if (!existing) {
                    await tx.sale.create({
                        data: {
                            listingId: id,
                            sellerId: listing.sellerId || userId,
                            buyerId: null,
                            soldPrice: listing.price,
                            buyerPostcode: buyerPostcode ?? null,
                        },
                    });
                }
                return next;
            })
            : await this.prisma.listing.update({
                where: { id },
                data: { status },
            });

        // Phase 2: Increment listing count if status changed TO Active from something else
        if (status === 'ACTIVE' && updated.sellerId && listing.status !== 'ACTIVE') {
            await this.sellersService.incrementListings(updated.sellerId);
        }

        // Phase 2: Increment sales count if marked as SOLD
        if (isNewSold && updated.sellerId) {
            await this.sellersService.incrementSales(updated.sellerId);
        }

        return updated;
    }

    /**
     * Activate a DRAFT listing after verifying a completed LISTING_FEE payment.
     * Safe to call at any time — idempotent if listing is already ACTIVE.
     *
     * Handles two cases:
     *   1. Transaction is COMPLETED (webhook already ran) — activate immediately.
     *   2. Transaction is PENDING with a stripePaymentId (webhook failed/delayed) —
     *      verify directly with Stripe; if paid, mark COMPLETED and activate.
     *
     * Returns { activated: true } or { activated: false, requiresPayment: true }.
     */
    async publishListing(id: string, userId: string): Promise<{ activated: boolean; requiresPayment?: boolean; pendingReview?: boolean }> {
        const listing = await this.findById(id);

        if (!listing || listing.sellerId !== userId) {
            throw new ForbiddenException('You do not have permission to publish this listing');
        }

        // HPI is an optional paid add-on for both Retail and Auction listings.
        // Submission readiness is based on listing completeness only.
        const readiness = getListingSubmissionReadiness(listing);
        if (readiness.missingFields.length > 0) {
            throw new BadRequestException(
                `Listing is not ready to submit. Missing: ${readiness.missingFields.join(', ')}.`,
            );
        }

        // An AUCTION listing is only a vehicle shell until its Auction row exists.
        // Never let an orphan listing enter review or become active: this prevents
        // incomplete quick-list/two-request flows from producing invisible auctions.
        if (listing.type === 'AUCTION') {
            const auction = await this.prisma.auction.findUnique({
                where: { listingId: id },
                select: { id: true, deletedAt: true, status: true, startTime: true, endTime: true },
            });
            if (!auction || auction.deletedAt) {
                throw new BadRequestException(
                    'Auction setup is incomplete. Add the auction schedule, reserve and bidding settings before submitting for review.',
                );
            }

            // Admin rejection cancels the pending auction so it can never start
            // accidentally. When the seller fixes and resubmits that rejected
            // listing, re-arm the same Auction row instead of forcing duplicate
            // listing/auction creation. A past schedule restarts from now.
            if (auction.status === 'CANCELLED' && listing.status === 'REJECTED') {
                const now = new Date();
                const startTime = auction.startTime > now ? auction.startTime : now;
                await this.prisma.auction.update({
                    where: { id: auction.id },
                    data: {
                        status: 'SCHEDULED',
                        startTime,
                        endTime: new Date(startTime.getTime() + AUCTION_DURATION_MS),
                    },
                });
            } else if (auction.status !== 'SCHEDULED' && listing.status !== 'ACTIVE' && listing.status !== 'PENDING_REVIEW') {
                throw new BadRequestException(
                    `Auction cannot be submitted while its auction status is ${auction.status}. Create or restart the auction schedule first.`,
                );
            }
        }

        // New public retail listings are BASIC (£1), while already-created
        // STANDARD/PREMIUM rows may represent a genuine legacy paid entitlement.
        // Preserve those historical rows here; all new creation/checkout paths
        // normalize to BASIC so retired packages cannot be newly purchased.
        const effectiveBadgeTier =
            listing.type === 'AUCTION'
                ? 'FREE'
                : (listing.badgeTier === 'STANDARD' || listing.badgeTier === 'PREMIUM')
                    ? listing.badgeTier
                    : 'BASIC';

        if (effectiveBadgeTier !== listing.badgeTier) {
            await this.prisma.listing.update({
                where: { id },
                data: { badgeTier: effectiveBadgeTier },
            });
        }

        // Already active — nothing to do
        if (listing.status === 'ACTIVE') {
            return { activated: true };
        }

        // Already submitted — nothing to do, still waiting on the admin
        if (listing.status === 'PENDING_REVIEW') {
            return { activated: false, pendingReview: true };
        }

        // A REJECTED listing may be resubmitted (the seller has presumably fixed the
        // issue the admin flagged) without paying again, since the fee was already
        // charged the first time.
        if (listing.status !== 'DRAFT' && listing.status !== 'REJECTED') {
            throw new BadRequestException('Only DRAFT or REJECTED listings can be submitted for review');
        }

        // Admin-created listings skip the seller listing fee. Pricing is still
        // normalized to FREE for Auction or BASIC for Retail.
        //
        // Enforced here rather than in the wizard on purpose: the frontend calls
        // publishListing() first and only redirects to Stripe when this returns
        // requiresPayment, so returning pendingReview is enough to bypass
        // checkout entirely — and being server-side, a non-admin can't fake it
        // by editing the client.
        const actor = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        const isAdmin = actor?.role === 'ADMIN';

        // Admin listings skip both the fee and the review queue — an admin
        // approving their own listing is a formality, and the review pipeline
        // exists to check other people's submissions.
        //
        // Uses the same activation shape as AdminService.approveListing so all
        // activation paths clear stale legacy package-feature flags consistently.
        //
        // No approval email or notification is sent: those tell a seller that
        // someone reviewed their listing, and here nobody did.
        if (isAdmin) {
            await this.prisma.listing.update({
                where: { id },
                data: buildListingActivationData(effectiveBadgeTier),
            });
            if (listing.sellerId) {
                await this.sellersService.incrementListings(listing.sellerId).catch(() => { });
            }
            this.logger.log(
                `Listing ${id} published directly by admin ${userId} on the ${effectiveBadgeTier} tier — no fee, no review`,
            );
            return { activated: true };
        }

        // Only FREE AUCTION listings skip the listing fee.
        if (listing.type === 'AUCTION' && effectiveBadgeTier === 'FREE') {
            await this.prisma.listing.update({ where: { id }, data: { status: 'PENDING_REVIEW', rejectionReason: null } });
            await this.notifySubmittedForReview(listing);
            return { activated: false, pendingReview: true };
        }

        // Find ALL LISTING_FEE transactions for this listing (there may be several if the user
        // attempted payment more than once). Check newest-first — but a newer PENDING session that
        // the user never completed must not shadow an older session they actually paid.
        const transactions = await (this.prisma as any).transaction.findMany({
            where: { listingId: id, type: 'LISTING_FEE' },
            orderBy: { createdAt: 'desc' },
        });

        if (!transactions.length) {
            return { activated: false, requiresPayment: true };
        }

        // Case 1: any transaction already marked COMPLETED
        const completedTx = transactions.find((t: any) => t.status === 'COMPLETED');
        if (completedTx) {
            await this.prisma.listing.update({
                where: { id },
                data: { status: 'PENDING_REVIEW', rejectionReason: null },
            });
            await this.notifySubmittedForReview(listing);
            return { activated: false, pendingReview: true };
        }

        // Case 2: no COMPLETED transaction — verify each PENDING one against Stripe
        // until we find one that was actually paid (webhook-missed scenario).
        let verifiedTxId: string | null = null;
        try {
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
                apiVersion: '2026-02-25.clover',
            });
            for (const tx of transactions) {
                if (!tx.stripePaymentId) continue;
                try {
                    const session = await stripe.checkout.sessions.retrieve(tx.stripePaymentId);
                    if (session.payment_status === 'paid') {
                        // Heal this transaction so future calls are instant
                        await (this.prisma as any).transaction.update({
                            where: { id: tx.id },
                            data: {
                                status: 'COMPLETED',
                                stripePaymentId: (session.payment_intent as string) ?? session.id,
                            },
                        });
                        verifiedTxId = tx.id;
                        break;
                    }
                } catch {
                    // This specific session ID invalid/expired — try next
                }
            }
        } catch {
            // Stripe SDK init failed — fall through to requiresPayment
        }

        if (!verifiedTxId) {
            return { activated: false, requiresPayment: true };
        }

        await this.prisma.listing.update({
            where: { id },
            data: { status: 'PENDING_REVIEW', rejectionReason: null },
        });
        await this.notifySubmittedForReview(listing);

        return { activated: false, pendingReview: true };
    }

    /**
     * Record a final sale for a listing
     * Marks listing as SOLD and creates a Sale record for earnings tracking
     */
    async recordSale(
        id: string,
        userId: string,
        dto: { soldPrice: number; buyerId?: string; buyerName?: string; buyerEmail?: string; buyerPostcode?: string },
    ): Promise<Listing> {
        const listing = await this.findById(id);

        if (listing.sellerId && listing.sellerId !== userId) {
            const staffMember = await this.prisma.dealerStaff.findFirst({
                where: {
                    userId,
                    dealerProfile: { userId: listing.sellerId },
                    isActive: true,
                },
            });
            if (!staffMember) {
                throw new ForbiddenException('You do not have permission to mark this listing as sold');
            }
        }

        if (listing.status === 'SOLD') {
            throw new BadRequestException('This listing is already marked as sold');
        }

        const effectiveSellerId = listing.sellerId || userId;

        // When a retail offer has already been accepted, the accepted negotiation
        // is authoritative for buyer + sold price. The seller must not be able to
        // accidentally type a different buyer or amount while completing the sale.
        const acceptedOffer = listing.status === 'OFFER_ACCEPTED'
            ? await this.prisma.offer.findFirst({
                where: { listingId: id, status: 'ACCEPTED' },
                orderBy: { updatedAt: 'desc' },
                include: {
                    buyer: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
            })
            : null;

        if (listing.status === 'OFFER_ACCEPTED' && !acceptedOffer) {
            throw new BadRequestException(
                'This listing is marked Sale Pending but no accepted offer exists. Cancel/relist the pending deal before recording a sale.',
            );
        }

        const agreedPrice = acceptedOffer
            ? Number(acceptedOffer.finalAmount ?? acceptedOffer.counterAmount ?? acceptedOffer.amount)
            : dto.soldPrice;
        const agreedBuyerId = acceptedOffer?.buyerId ?? dto.buyerId ?? null;
        const agreedBuyerName = acceptedOffer
            ? [acceptedOffer.buyer?.firstName, acceptedOffer.buyer?.lastName].filter(Boolean).join(' ') || null
            : dto.buyerName ?? null;
        const agreedBuyerEmail = acceptedOffer?.buyer?.email ?? dto.buyerEmail ?? null;

        if (!Number.isFinite(agreedPrice) || agreedPrice <= 0) {
            throw new BadRequestException('A valid sold price is required');
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const updatedListing = await tx.listing.update({
                where: { id },
                data: { status: 'SOLD' },
            });

            // Defensive close: once SOLD, no pending/countered negotiation may
            // remain actionable, including manual/off-platform sales.
            await tx.offer.updateMany({
                where: {
                    listingId: id,
                    status: { in: ['PENDING', 'COUNTERED'] },
                },
                data: {
                    status: 'REJECTED',
                    counterExpiresAt: null,
                },
            });

            await tx.sale.upsert({
                where: { listingId: id },
                create: {
                    listingId: id,
                    sellerId: effectiveSellerId,
                    buyerId: agreedBuyerId,
                    buyerName: agreedBuyerName,
                    buyerEmail: agreedBuyerEmail,
                    buyerPostcode: dto.buyerPostcode ?? null,
                    soldPrice: agreedPrice,
                },
                update: {
                    sellerId: effectiveSellerId,
                    buyerId: agreedBuyerId,
                    buyerName: agreedBuyerName,
                    buyerEmail: agreedBuyerEmail,
                    buyerPostcode: dto.buyerPostcode ?? null,
                    soldPrice: agreedPrice,
                },
            });

            return updatedListing;
        });

        if (effectiveSellerId) {
            this.sellersService.incrementSales(effectiveSellerId).catch((err) => {
                console.error(`recordSale: incrementSales failed for ${effectiveSellerId}:`, err?.message);
            });
        }

        return updated;
    }

    /**
     * Create a linked CLASSIFIED retail listing alongside an existing AUCTION listing.
     * Copies all vehicle data; the new listing starts as DRAFT pending payment.
     * Returns the new listing's ID so the caller can initiate a Stripe checkout.
     */
    async alsoListRetail(
        listingId: string,
        userId: string,
        dto: { price: number; badgeTier?: 'BASIC' | 'STANDARD' | 'PREMIUM' },
    ): Promise<{ linkedListingId: string }> {
        const newListingId = randomUUID();

        return this.prisma.$transaction(async (tx) => {
            let source = await tx.listing.findUnique({
                where: { id: listingId },
            });
            if (!source || source.deletedAt) throw new NotFoundException('Listing not found');
            if (source.sellerId !== userId) throw new ForbiddenException('You do not own this listing');
            if (source.type !== 'AUCTION') throw new BadRequestException('Source listing must be of type AUCTION');

            // A repeated request must resume the existing linked retail DRAFT,
            // not delete it and create a fresh listing/payment target.
            if (source.linkedListingId) {
                const existingLinked = await tx.listing.findUnique({
                    where: { id: source.linkedListingId },
                    select: { id: true, deletedAt: true },
                });
                if (existingLinked && !existingLinked.deletedAt) {
                    return { linkedListingId: existingLinked.id };
                }

                // Heal only a stale pointer to a missing/soft-deleted row.
                await tx.listing.updateMany({
                    where: {
                        id: listingId,
                        linkedListingId: source.linkedListingId,
                    },
                    data: { linkedListingId: null },
                });
                source = { ...source, linkedListingId: null };
            }

            const claimed = await tx.listing.updateMany({
                where: {
                    id: listingId,
                    sellerId: userId,
                    type: 'AUCTION',
                    linkedListingId: null,
                    deletedAt: null,
                },
                data: { linkedListingId: newListingId },
            });

            if (claimed.count !== 1) {
                const refreshed = await tx.listing.findUnique({
                    where: { id: listingId },
                    select: { linkedListingId: true },
                });
                if (refreshed?.linkedListingId) {
                    return { linkedListingId: refreshed.linkedListingId };
                }
                throw new BadRequestException(
                    'The auction listing changed while the retail listing was being created. Refresh and try again.',
                );
            }

            const slug = this.generateSlug(source.title);
            await tx.listing.create({
                data: {
                    id: newListingId,
                    title: source.title,
                    price: dto.price,
                    images: source.images,
                    videoUrls: source.videoUrls,
                    type: 'CLASSIFIED',
                    status: 'DRAFT',
                    description: source.description,
                    slug,
                    make: source.make, model: source.model, year: source.year, mileage: source.mileage,
                    vrm: source.vrm, vin: source.vin,
                    fuelType: source.fuelType, transmission: source.transmission,
                    color: source.color, doors: source.doors, seats: source.seats,
                    engineSize: source.engineSize, bhp: source.bhp, bodyType: source.bodyType,
                    features: source.features ?? undefined,
                    location: source.location, latitude: source.latitude, longitude: source.longitude,
                    condition: source.condition, ulezCompliant: source.ulezCompliant,
                    euroStandard: source.euroStandard, co2Emissions: source.co2Emissions,
                    motStatus: source.motStatus, taxStatus: source.taxStatus,
                    motExpiryDate: source.motExpiryDate, taxDueDate: source.taxDueDate,
                    markedForExport: source.markedForExport,
                    monthOfFirstRegistration: source.monthOfFirstRegistration,
                    wheelplan: source.wheelplan, typeApproval: source.typeApproval,
                    variant: source.variant, driveType: source.driveType,
                    numberOfKeys: source.numberOfKeys, serviceHistory: source.serviceHistory,
                    owners: source.owners, torqueNm: source.torqueNm,
                    topSpeedMph: source.topSpeedMph, zeroTo60Mph: source.zeroTo60Mph,
                    combinedMpg: source.combinedMpg, extraUrbanMpg: source.extraUrbanMpg,
                    exteriorGrade: source.exteriorGrade,
                    bannerLabel: source.bannerLabel,
                    badgeTier: 'BASIC',
                    sellerId: userId,
                    vehicleType: source.vehicleType,
                    isImported: source.isImported,
                    stolenRecovered: source.stolenRecovered,
                    hasOutstandingFinance: source.hasOutstandingFinance,
                    isLegalRegisteredKeeper: source.isLegalRegisteredKeeper,
                    writeOffCategory: source.writeOffCategory,
                    linkedListingId: listingId,
                } as any,
            });

            return { linkedListingId: newListingId };
        });
    }

    /**
     * Create a linked AUCTION listing alongside an existing CLASSIFIED retail listing.
     * Copies all vehicle data; the FREE auction listing is created PENDING_REVIEW and goes live only after admin approval.
     * Returns the new auction listing ID and the Auction record ID.
     */
    async alsoAuction(
        listingId: string,
        userId: string,
        dto: AlsoAuctionDto,
    ): Promise<{ linkedListingId: string; auctionId: string }> {
        const startTime = new Date(dto.startTime);
        if (Number.isNaN(startTime.getTime()) || startTime.getTime() < Date.now() - 60_000) {
            throw new BadRequestException('Invalid or past startTime');
        }
        const endTime = new Date(startTime.getTime() + AUCTION_DURATION_MS);
        const auctionListingId = randomUUID();

        const result = await this.prisma.$transaction(async (tx) => {
            // Re-read the source inside the transaction. Validation done before
            // a transaction can go stale between read and write (sold/withdrawn,
            // deleted, ownership changed, or another alsoAuction request winning
            // the race). This is the authoritative snapshot used for cloning.
            const source = await tx.listing.findUnique({
                where: { id: listingId },
                include: {
                    hpiReport: { select: { id: true } },
                },
            });

            if (!source || source.deletedAt) {
                throw new NotFoundException('Listing not found');
            }
            if (source.sellerId !== userId) {
                throw new ForbiddenException('You do not own this listing');
            }
            if (source.type !== 'CLASSIFIED') {
                throw new BadRequestException('Source listing must be of type CLASSIFIED');
            }
            if (source.status !== 'ACTIVE') {
                throw new BadRequestException('Only an active retail listing can also be placed into auction');
            }
            if (source.linkedListingId) {
                throw new BadRequestException('This listing already has a linked auction listing');
            }
            // A linked auction still has to satisfy the normal listing
            // completeness rules, but HPI remains optional just as it is for the
            // source Retail listing.
            const linkedReadiness = getListingSubmissionReadiness(source);
            if (linkedReadiness.missingFields.length > 0) {
                throw new BadRequestException(
                    `The retail listing is not complete enough to create an auction. Missing: ${linkedReadiness.missingFields.join(', ')}.`,
                );
            }

            const sourceValue = Number(source.price);
            if (!Number.isFinite(sourceValue) || sourceValue <= 0) {
                throw new BadRequestException('A valid vehicle price is required before creating the linked auction');
            }
            if (dto.reservePrice > sourceValue) {
                throw new BadRequestException(
                    `Reserve price (£${dto.reservePrice.toLocaleString('en-GB')}) cannot exceed the retail listing price (£${sourceValue.toLocaleString('en-GB')}). Lower the reserve or raise the retail price first.`,
                );
            }

            const platformStartingBid = calculatePlatformOpeningBid(sourceValue);
            const slug = this.generateSlug(source.title);

            // Compare-and-set the reverse link while every eligibility condition
            // is still true. Two concurrent requests may both read linkedListingId
            // as null, but only one can update this row with linkedListingId:null
            // in the WHERE clause. A stale/sold/withdrawn/deleted source also fails
            // this claim. Throwing rolls back the entire transaction.
            const claimed = await tx.listing.updateMany({
                where: {
                    id: listingId,
                    sellerId: userId,
                    type: 'CLASSIFIED',
                    status: 'ACTIVE',
                    linkedListingId: null,
                    deletedAt: null,
                },
                data: { linkedListingId: auctionListingId },
            });

            if (claimed.count !== 1) {
                throw new BadRequestException(
                    'The retail listing changed while the auction was being created. Refresh the listing before trying again.',
                );
            }

            // Nested Auction creation makes the linked AUCTION Listing + Auction
            // row one atomic write. The clone remains PENDING_REVIEW and the
            // Auction remains SCHEDULED; the lifecycle cron cannot activate it
            // until admin approval changes the Listing to ACTIVE.
            const auctionListing = await tx.listing.create({
                data: {
                    id: auctionListingId,
                    title: source.title,
                    price: source.price,
                    images: source.images,
                    videoUrls: source.videoUrls,
                    type: 'AUCTION',
                    status: 'PENDING_REVIEW',
                    description: source.description,
                    slug,
                    make: source.make, model: source.model, year: source.year, mileage: source.mileage,
                    vrm: source.vrm, vin: source.vin,
                    fuelType: source.fuelType, transmission: source.transmission,
                    color: source.color, doors: source.doors, seats: source.seats,
                    engineSize: source.engineSize, bhp: source.bhp, bodyType: source.bodyType,
                    features: source.features ?? undefined,
                    location: source.location, latitude: source.latitude, longitude: source.longitude,
                    condition: source.condition, ulezCompliant: source.ulezCompliant,
                    euroStandard: source.euroStandard, co2Emissions: source.co2Emissions,
                    motStatus: source.motStatus, taxStatus: source.taxStatus,
                    motExpiryDate: source.motExpiryDate, taxDueDate: source.taxDueDate,
                    markedForExport: source.markedForExport,
                    monthOfFirstRegistration: source.monthOfFirstRegistration,
                    wheelplan: source.wheelplan, typeApproval: source.typeApproval,
                    variant: source.variant, driveType: source.driveType,
                    numberOfKeys: source.numberOfKeys, serviceHistory: source.serviceHistory,
                    owners: source.owners, torqueNm: source.torqueNm,
                    topSpeedMph: source.topSpeedMph, zeroTo60Mph: source.zeroTo60Mph,
                    combinedMpg: source.combinedMpg, extraUrbanMpg: source.extraUrbanMpg,
                    exteriorGrade: source.exteriorGrade,
                    bannerLabel: source.bannerLabel,
                    badgeTier: 'FREE',
                    sellerId: userId,
                    vehicleType: source.vehicleType,
                    isImported: source.isImported,
                    stolenRecovered: source.stolenRecovered,
                    hasOutstandingFinance: source.hasOutstandingFinance,
                    isLegalRegisteredKeeper: source.isLegalRegisteredKeeper,
                    writeOffCategory: source.writeOffCategory,
                    linkedListingId: listingId,
                    auction: {
                        create: {
                            startTime,
                            endTime,
                            reservePrice: dto.reservePrice,
                            startingBid: platformStartingBid,
                            minIncrement: dto.minIncrement ?? 100,
                            buyItNowPrice: dto.buyItNowPrice ?? null,
                            status: 'SCHEDULED',
                        },
                    },
                } as any,
                include: { auction: true },
            });

            if (!auctionListing.auction) {
                throw new BadRequestException('Linked auction setup could not be completed');
            }

            return {
                auctionListing,
                auctionId: auctionListing.auction.id,
            };
        });

        await this.notifySubmittedForReview({
            id: result.auctionListing.id,
            title: result.auctionListing.title,
            sellerId: result.auctionListing.sellerId,
        });

        return {
            linkedListingId: result.auctionListing.id,
            auctionId: result.auctionId,
        };
    }

    /**
     * Soft delete a listing
     * Sets deletedAt to current timestamp
     * Includes ownership check
     */
    async softDelete(id: string, userId: string): Promise<Listing> {
        // First, fetch the listing to verify ownership
        const listing = await this.findById(id);

        // Ownership check (skip if no sellerId - for development)
        if (listing.sellerId && listing.sellerId !== userId) {
            throw new ForbiddenException('You do not have permission to delete this listing');
        }

        // Soft delete by setting deletedAt
        const deletedListing = await this.prisma.listing.update({
            where: { id },
            data: {
                deletedAt: new Date(),
            },
        });

        return deletedListing;
    }

    /**
     * Find all listings belonging to a specific seller
     *
     * By default this excludes SOLD listings so the seller's "Inventory" view stays clean.
     * Pages that need to render offers tied to already-sold listings (e.g. the Offers
     * dashboard, where an accepted offer must remain visible after the sale closes)
     * should pass `includeSold = true`.
     */
    async findMyListings(sellerId: string, filterDto?: ListingFilterDto): Promise<{ data: Listing[]; total: number }> {
        const page = filterDto?.page || 1;
        const limit = filterDto?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {
            sellerId,
            deletedAt: null,
        };
        if (!filterDto?.includeSold) {
            where.status = { not: 'SOLD' };
        }

        // Apply optional filters
        if (filterDto?.minPrice !== undefined || filterDto?.maxPrice !== undefined) {
            where.price = {};
            if (filterDto.minPrice !== undefined) where.price.gte = filterDto.minPrice;
            if (filterDto.maxPrice !== undefined) where.price.lte = filterDto.maxPrice;
        }

        if (filterDto?.make) {
            where.make = { contains: filterDto.make, mode: 'insensitive' };
        }

        const [data, total] = await Promise.all([
            this.prisma.listing.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { offers: { _count: 'desc' } },
                    { createdAt: 'desc' }
                ],
                include: {
                    hpiReport: true,
                    linkedListing: { select: { id: true, status: true, badgeTier: true } },
                    // Dealer inventory (mobile's DealerInventoryScreen, web's
                    // inventory table) needs real per-listing lead/offer
                    // counts — this endpoint previously only used the offers
                    // relation for sort order (below) without ever selecting
                    // it, so consumers always got 0.
                    _count: { select: { offers: true, leads: true } },
                },
            }),
            this.prisma.listing.count({ where }),
        ]);

        return { data, total };
    }

    /**
     * Resolve the effective dealership owner ID for a given user.
     * If the user is active dealer staff, returns the dealership owner's userId
     * so all aggregations (revenue, listings) reflect the dealership as a unit.
     */
    private async resolveOwnerId(userId: string): Promise<string> {
        try {
            const staffRecord = await this.prisma.dealerStaff.findFirst({
                where: { userId, isActive: true },
                select: { dealerProfile: { select: { userId: true } } },
            });
            if (staffRecord?.dealerProfile?.userId) {
                return staffRecord.dealerProfile.userId;
            }
        } catch {
            // Fall through and return the original userId on any lookup failure
        }
        return userId;
    }

    /**
     * Get seller dashboard statistics
     *
     * Total revenue is sourced from `Sale.soldPrice` (the canonical earnings table),
     * not from `Listing.price`, so the metric stays consistent with the unified
     * dashboard and the earnings page.
     */
    async getSellerStats(userId: string): Promise<{
        totalListings: number;
        activeListings: number;
        soldListings: number;
        draftListings: number;
        totalViews: number;
        totalRevenue: number;
    }> {
        const sellerId = await this.resolveOwnerId(userId);
        const baseWhere = { sellerId, deletedAt: null };

        const [totalListings, activeListings, soldListings, draftListings, viewsAggregate, salesAggregate] = await Promise.all([
            this.prisma.listing.count({ where: baseWhere }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'SOLD' } }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'DRAFT' } }),
            this.prisma.listing.aggregate({
                where: baseWhere,
                _sum: { viewCount: true },
            }),
            this.prisma.sale.aggregate({
                where: { sellerId },
                _sum: { soldPrice: true },
            }),
        ]);

        return {
            totalListings,
            activeListings,
            soldListings,
            draftListings,
            totalViews: viewsAggregate._sum.viewCount || 0,
            totalRevenue: Number(salesAggregate._sum.soldPrice || 0),
        };
    }

    /**
     * Get seller performance analytics
     * Returns metrics + per-listing view data for charts
     *
     * Revenue is sourced from the `Sale` table for consistency with other dashboards.
     */
    async getSellerPerformance(userId: string) {
        const sellerId = await this.resolveOwnerId(userId);
        const baseWhere = { sellerId, deletedAt: null };

        const [totalListings, soldCount, viewsAggregate, recentListings, salesAggregate, sellerProfile, reviewAggregate, respondedOffers] = await Promise.all([
            this.prisma.listing.count({ where: baseWhere }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'SOLD' } }),
            this.prisma.listing.aggregate({
                where: baseWhere,
                _sum: { viewCount: true },
            }),
            this.prisma.listing.findMany({
                where: baseWhere,
                select: { id: true, title: true, viewCount: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 12,
            }),
            this.prisma.sale.aggregate({
                where: { sellerId },
                _sum: { soldPrice: true },
            }),
            this.prisma.sellerProfile.findUnique({
                where: { userId: sellerId },
                select: { reliabilityScore: true, avgResponseHours: true },
            }),
            this.prisma.sellerReview.aggregate({
                where: { sellerProfile: { userId: sellerId } },
                _avg: { rating: true },
                _count: { id: true },
            }),
            // Offers where the seller actually responded — used to compute avg response time
            this.prisma.offer.findMany({
                where: {
                    listing: { sellerId, deletedAt: null },
                    status: { in: ['ACCEPTED', 'REJECTED', 'COUNTERED'] },
                },
                select: { createdAt: true, updatedAt: true },
                orderBy: { updatedAt: 'desc' },
                take: 100,
            }),
        ]);

        const totalViews = viewsAggregate._sum.viewCount || 0;
        const conversionRate = totalViews > 0
            ? ((soldCount / totalViews) * 100).toFixed(1)
            : '0.0';

        // Prefer stored avgResponseHours; calculate live from offer latency as fallback
        let avgResponseHours: number | null = sellerProfile?.avgResponseHours ?? null;
        if (avgResponseHours === null && respondedOffers.length > 0) {
            const totalMs = respondedOffers.reduce(
                (sum, o) => sum + (o.updatedAt.getTime() - o.createdAt.getTime()), 0
            );
            avgResponseHours = parseFloat(
                (totalMs / respondedOffers.length / (1000 * 60 * 60)).toFixed(1)
            );
        }

        const sellerRating = reviewAggregate._avg.rating != null
            ? parseFloat(reviewAggregate._avg.rating.toFixed(1))
            : null;
        const totalReviews = reviewAggregate._count.id ?? 0;

        return {
            totalRevenue: Number(salesAggregate._sum.soldPrice || 0),
            totalViews,
            totalListings,
            conversionRate: parseFloat(conversionRate),
            recentListingViews: recentListings.map(l => ({
                id: l.id,
                title: l.title,
                views: l.viewCount,
                date: l.createdAt,
            })),
            avgResponseHours,
            sellerRating,
            totalReviews,
        };
    }

    /**
     * Get earnings history for a seller or dealer
     */
    async getEarnings(userId: string, page = 1, limit = 20) {
        // Handle staff/owner logic
        let targetOwnerId = userId;
        const staffRecord = await this.prisma.dealerStaff.findFirst({
            where: { userId, isActive: true },
            select: { dealerProfile: { select: { userId: true } } }
        });
        if (staffRecord) {
            targetOwnerId = staffRecord.dealerProfile.userId;
        }

        const skip = (page - 1) * limit;
        const where = { sellerId: targetOwnerId };

        const [sales, totalSales, revenueAgg] = await Promise.all([
            this.prisma.sale.findMany({
                where,
                include: {
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            images: true,
                            vrm: true,
                            price: true,
                            status: true,
                            offers: {
                                orderBy: { createdAt: 'desc' },
                                take: 10,
                                select: {
                                    id: true,
                                    amount: true,
                                    initialAmount: true,
                                    counterAmount: true,
                                    sellerCounterAmount: true,
                                    buyerCounterAmount: true,
                                    finalAmount: true,
                                    status: true,
                                    createdAt: true,
                                    buyer: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                        }
                                    }
                                }
                            }
                        }
                    },
                    buyer: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.sale.count({ where }),
            this.prisma.sale.aggregate({ where, _sum: { soldPrice: true } }),
        ]);

        // Auctions the seller has actually been paid out on — sellerBonusReleased is
        // only ever set true once an admin has approved the handover proof, so this
        // can't include auctions that are still mid-handover or were denied/refunded.
        // The vehicle price itself (winningBidAmount) is settled directly between
        // buyer and seller — Carmazium never processes that payment — but retail
        // Sale.soldPrice is the same kind of self-reported figure, so counting both
        // the same way in totalRevenue keeps "how much business have I done here"
        // accurate across both channels. The £100 bonus is the only amount Carmazium
        // itself actually paid out, tracked separately so that distinction stays clear.
        const AUCTION_SELLER_BONUS = 100;
        const auctionWhere = {
            listing: { sellerId: targetOwnerId },
            status: 'ENDED' as const,
            winnerId: { not: null },
            sellerBonusReleased: true,
            deletedAt: null,
        };
        const auctionSalesRaw = await this.prisma.auction.findMany({
            where: auctionWhere,
            include: {
                listing: { select: { id: true, title: true, images: true, vrm: true } },
                winner: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { sellerBonusReleasedAt: 'desc' },
        });

        const totalAuctionSales = auctionSalesRaw.length;
        const totalAuctionRevenue = auctionSalesRaw.reduce((sum, a) => sum + Number(a.winningBidAmount ?? 0), 0);
        const totalAuctionBonus = totalAuctionSales * AUCTION_SELLER_BONUS;

        const auctionSales = auctionSalesRaw.map(a => ({
            id: a.id,
            listingId: a.listingId,
            winningBidAmount: Number(a.winningBidAmount ?? 0),
            sellerBonus: AUCTION_SELLER_BONUS,
            sellerBonusReleasedAt: a.sellerBonusReleasedAt,
            createdAt: a.sellerBonusReleasedAt ?? a.updatedAt,
            listing: a.listing,
            winner: a.winner,
        }));

        const totalRevenue = Number(revenueAgg._sum.soldPrice ?? 0) + totalAuctionRevenue;

        return {
            sales,
            totalRevenue,
            totalSales: totalSales + totalAuctionSales,
            auctionSales,
            totalAuctionRevenue,
            totalAuctionSales,
            totalAuctionBonus,
            page,
            totalPages: Math.ceil(totalSales / limit),
        };
    }

    /**
     * Use vision to choose a professional cover photo from customer-uploaded
     * vehicle images. The original image order remains the fallback when AI is
     * unavailable, and callers can always override the recommendation manually.
     */
    async recommendVehicleCoverPhoto(imageUrls: string[]) {
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
            throw new BadRequestException('At least one vehicle photo is required');
        }
        if (imageUrls.length > 30) {
            throw new BadRequestException('A maximum of 30 vehicle photos can be analysed at once');
        }

        const supabaseBase = this.config.get<string>('SUPABASE_URL')
            || this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        if (!supabaseBase) {
            throw new BadRequestException('Vehicle photo analysis is not configured');
        }

        let allowedOrigin = '';
        try {
            allowedOrigin = new URL(supabaseBase).origin;
        } catch {
            throw new BadRequestException('Vehicle photo analysis is not configured');
        }

        const safeUrls = imageUrls.map((value) => {
            if (typeof value !== 'string') return null;
            const clean = value.split('#')[0];
            try {
                const parsed = new URL(clean);
                if (parsed.protocol !== 'https:' || parsed.origin !== allowedOrigin) return null;
                if (!parsed.pathname.startsWith('/storage/v1/object/public/listings/')) return null;
                return clean;
            } catch {
                return null;
            }
        });

        if (safeUrls.some((url) => !url)) {
            throw new BadRequestException('Only CarMazium listing photos can be analysed');
        }

        const apiKey = this.config.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
            return {
                recommendedIndex: null,
                confidence: 0,
                view: 'unknown',
                reason: 'Automatic cover selection is not configured.',
            };
        }

        const client = new OpenAI({ apiKey });
        const content: any[] = [
            {
                type: 'input_text',
                text: [
                    'You are selecting the primary cover photo for a UK vehicle marketplace listing.',
                    'Identify which supplied photo shows the FRONT of the vehicle and is the strongest professional cover.',
                    'Prefer, in order: straight-on front, front three-quarter, then another clearly front-biased exterior view.',
                    'The whole vehicle should be visible where possible, sharp, well-lit, unobstructed and reasonably centred.',
                    'Do not choose rear, side-only, interior, detail, damage, document, screenshot or non-vehicle photos.',
                    'If no photo clearly shows the front or front three-quarter of the vehicle, return recommendedIndex null.',
                    'Indexes are zero-based and correspond to the labels immediately before each image.',
                ].join(' '),
            },
        ];

        safeUrls.forEach((url, index) => {
            content.push({ type: 'input_text', text: `Photo index ${index}` });
            content.push({ type: 'input_image', image_url: url, detail: 'low' });
        });

        try {
            const response = await client.responses.create({
                model: this.config.get<string>('OPENAI_VISION_MODEL') || 'gpt-5.6-luna',
                input: [{ role: 'user', content }],
                reasoning: { effort: 'none' },
                max_output_tokens: 300,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'vehicle_cover_selection',
                        strict: true,
                        schema: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                recommendedIndex: { type: ['integer', 'null'] },
                                confidence: { type: 'number', minimum: 0, maximum: 1 },
                                view: {
                                    type: 'string',
                                    enum: ['front', 'front_three_quarter', 'side', 'rear', 'interior', 'detail', 'damage', 'other', 'unknown'],
                                },
                                reason: { type: 'string' },
                            },
                            required: ['recommendedIndex', 'confidence', 'view', 'reason'],
                        },
                    },
                },
            } as any);

            const parsed = JSON.parse(response.output_text || '{}');
            const recommendedIndex = Number.isInteger(parsed.recommendedIndex)
                && parsed.recommendedIndex >= 0
                && parsed.recommendedIndex < safeUrls.length
                ? parsed.recommendedIndex
                : null;

            return {
                recommendedIndex,
                confidence: typeof parsed.confidence === 'number'
                    ? Math.min(1, Math.max(0, parsed.confidence))
                    : 0,
                view: typeof parsed.view === 'string' ? parsed.view : 'unknown',
                reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 240) : '',
            };
        } catch (error: any) {
            this.logger.warn(`Vehicle cover photo analysis failed: ${error?.message || error}`);
            return {
                recommendedIndex: null,
                confidence: 0,
                view: 'unknown',
                reason: 'Automatic cover selection was unavailable. The photo order was left unchanged.',
            };
        }
    }

    /**
     * Scrape an external listing URL and return extracted data for user review.
     * Nothing is saved — this is a preview-only endpoint.
     */
    async previewImport(url: string) {
        return this.scraper.scrape(url);
    }

    /**
     * Import a listing from an external platform URL.
     * Creates a DRAFT CLASSIFIED listing owned by the requesting user.
     * The user must still go through the normal listing payment flow to activate it.
     */
    async importFromUrl(
        url: string,
        userId: string,
        overrides: {
            price: number;
            vrm: string;
            badgeTier?: string;
            title?: string;
        },
    ): Promise<Listing> {
        const scraped = await this.scraper.scrape(url);

        const title = overrides.title ?? scraped.title ?? 'Imported Listing';
        const slug = this.generateSlug(title);

        const fuelMap: Record<string, FuelType> = {
            PETROL: 'PETROL', DIESEL: 'DIESEL', ELECTRIC: 'ELECTRIC',
            HYBRID: 'HYBRID', PLUGIN_HYBRID: 'PLUGIN_HYBRID', LPG: 'LPG', HYDROGEN_CELL: 'HYDROGEN_CELL',
            BI_FUEL: 'BI_FUEL', NATURAL_GAS: 'NATURAL_GAS',
            PETROL_HYBRID: 'PETROL_HYBRID', DIESEL_HYBRID: 'DIESEL_HYBRID',
            PETROL_PLUGIN_HYBRID: 'PETROL_PLUGIN_HYBRID', DIESEL_PLUGIN_HYBRID: 'DIESEL_PLUGIN_HYBRID',
            UNLISTED: 'UNLISTED',
        };
        const transMap: Record<string, TransmissionType> = {
            MANUAL: 'MANUAL', AUTOMATIC: 'AUTOMATIC', SEMI_AUTOMATIC: 'SEMI_AUTOMATIC', CVT: 'CVT',
        };
        const bodyMap: Record<string, BodyType> = {
            SEDAN: 'SEDAN', SUV: 'SUV', HATCHBACK: 'HATCHBACK', COUPE: 'COUPE',
            CONVERTIBLE: 'CONVERTIBLE', ESTATE: 'ESTATE', CROSSOVER: 'CROSSOVER',
            SPORTS_CAR: 'SPORTS_CAR', MINIVAN: 'MINIVAN', PICKUP_TRUCK: 'PICKUP_TRUCK',
            STATION_WAGON: 'STATION_WAGON', MPV: 'MPV', VAN: 'VAN',
        };

        const badgeTier = 'BASIC'; // Fixed £1 retail product; ignore legacy package input.
        const normalizedVrm = this.normalizeVrm(overrides.vrm);

        const importResult = await this.prisma.$transaction(async (tx) => {
            if (normalizedVrm) {
                await this.lockVehicleCreation(tx, userId, normalizedVrm);
                const existing = await this.resolveExistingCreate(
                    tx,
                    userId,
                    normalizedVrm,
                    {
                        type: 'CLASSIFIED',
                        title,
                        price: overrides.price,
                        year: scraped.year ?? null,
                        mileage: scraped.mileage ?? null,
                        importedFromUrl: scraped.originalUrl ?? url,
                    },
                );
                if (existing) {
                    return { listing: existing, created: false };
                }
            }

            const created = await tx.listing.create({
                data: {
                    title,
                    price: overrides.price,
                    // Never persist third-party URLs. Imported photos are added only
                    // after the hardened downloader has copied verified image bytes
                    // into CarMazium-owned Storage.
                    images: [],
                    type: 'CLASSIFIED',
                    status: 'DRAFT',
                    slug,
                    description: scraped.description ?? null,
                    make: scraped.make ?? null,
                    model: scraped.model ?? null,
                    year: scraped.year ?? null,
                    mileage: scraped.mileage ?? null,
                    vrm: normalizedVrm || null,
                    vin: scraped.vin ?? null,
                    fuelType: scraped.fuelType ? (fuelMap[scraped.fuelType] ?? null) : null,
                    transmission: scraped.transmission ? (transMap[scraped.transmission] ?? null) : null,
                    color: scraped.color ?? null,
                    doors: scraped.doors ?? null,
                    engineSize: scraped.engineSize ?? null,
                    bhp: scraped.bhp ?? null,
                    bodyType: scraped.bodyType ? (bodyMap[scraped.bodyType] ?? null) : null,
                    location: scraped.location ?? null,
                    badgeTier,
                    sellerId: userId,
                    importedFromUrl: scraped.originalUrl,
                    importedSource: scraped.platform,
                } as any,
            });
            return { listing: created, created: true };
        });

        const listing = importResult.listing;
        if (!importResult.created) {
            return listing;
        }

        // External marketplace URLs never become Listing.images. The background
        // importer writes only validated CarMazium Storage URLs.
        if (
            scraped.images.length > 0
            && (scraped.platform === 'AUTOTRADER'
                || scraped.platform === 'CARGURUS'
                || scraped.platform === 'CARWOW')
        ) {
            void this.rehostImportedImages(
                scraped.images,
                userId,
                scraped.platform as ImportedListingPlatform,
            )
                .then((hostedUrls) => {
                    if (hostedUrls.length === 0) return;
                    return this.prisma.listing.update({
                        where: { id: listing.id },
                        data: { images: hostedUrls },
                    });
                })
                .catch((err) => this.logger.warn(
                    `Import image re-host failed for listing ${listing.id}: ${err?.message || err}`,
                ));
        }

        return listing;
    }
}
