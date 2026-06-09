import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateListingDto,
    FuelType as DtoFuelType,
    Transmission as DtoTransmission,
    BodyType as DtoBodyType,
} from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';
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
import { randomBytes } from 'crypto';
import { SellersService } from '../sellers/sellers.service';

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
    constructor(
        private readonly prisma: PrismaService,
        private readonly sellersService: SellersService,
        private readonly config: ConfigService,
    ) { }

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

    /**
     * Re-hosts external images to Supabase Storage
     */
    private async rehostImage(url: string): Promise<string> {
        if (!url || url.includes('supabase.co')) return url;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const buffer = await response.arrayBuffer();
            
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseKey) return url;

            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(supabaseUrl, supabaseKey);

            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            
            const { error } = await supabase.storage
                .from('listings')
                .upload(fileName, buffer, { contentType: response.headers.get('content-type') || 'image/jpeg' });
            
            if (error) throw error;
            
            return `${supabaseUrl}/storage/v1/object/public/listings/${fileName}`;
        } catch (err) {
            console.error('Failed to re-host image:', err);
            return url; // Fallback to original URL
        }
    }

    /**
     * Geocode a UK location string to lat/lng via OpenStreetMap Nominatim.
     * Returns null silently on any failure — never blocks listing creation.
     */
    private async geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&countrycodes=gb&format=json&limit=1`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Carmazium/1.0 (contact@carmazium.co.uk)' },
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

        const listingType: ListingType = createListingDto.listingType === 'AUCTION' ? 'AUCTION' : 'CLASSIFIED';

        // Badge tier — default FREE
        const badgeTier = createListingDto.badgeTier ?? 'FREE';
        const isPremium = badgeTier === 'PREMIUM';

        // Paid tiers (BASIC/STANDARD/PREMIUM) must start as DRAFT — the Stripe webhook
        // activates them once payment completes. FREE listings can be ACTIVE immediately.
        const listingStatus: ListingStatus = badgeTier !== 'FREE'
            ? 'DRAFT'
            : createListingDto.status === 'ACTIVE' ? 'ACTIVE'
            : createListingDto.status === 'SOLD' ? 'SOLD'
            : 'DRAFT';

        // Block imported vehicles
        if (createListingDto.isImported) {
            throw new BadRequestException('Imported vehicles cannot be listed on CarMazium.');
        }

        // Cat A and Cat B are total-loss / body-salvage write-offs that cannot be
        // re-registered. They may only be listed for auction (parts/scrapping).
        const writeOff = createListingDto.writeOffCategory;
        if ((writeOff === 'CAT_A' || writeOff === 'CAT_B') && listingType === 'CLASSIFIED') {
            throw new BadRequestException(
                'Cat A and Cat B write-offs cannot be listed for retail sale. Switch to an Auction listing to proceed.',
            );
        }

        // Create listing immediately with original image URLs so the endpoint returns fast.
        // Image re-hosting (Supabase upload) runs in the background and updates the record.
        const originalImages = createListingDto.images ?? [];

        const listing = await this.prisma.listing.create({
            data: {
                title: createListingDto.title,
                price: createListingDto.price,
                priceMin: createListingDto.priceMin ?? null,
                priceMax: createListingDto.priceMax ?? null,
                images: originalImages,
                type: listingType,
                status: listingStatus,
                description: createListingDto.description ?? null,
                slug,
                // Vehicle identity
                make: createListingDto.make ?? null,
                model: createListingDto.model ?? null,
                year: createListingDto.year,
                mileage: createListingDto.mileage,
                vrm: createListingDto.vrm ?? null,
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
                // Phase 7: Badge tier
                badgeTier,
                // Premium tier → auto-activate featured boost (28 days)
                isFeatured: isPremium,
                featuredUntil: isPremium ? new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) : null,
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
            },
        });

        // Re-host images in background — non-blocking so the endpoint returns immediately
        if (originalImages.length > 0) {
            Promise.all(originalImages.map(img => this.rehostImage(img)))
                .then(hostedUrls => this.prisma.listing.update({
                    where: { id: listing.id },
                    data: { images: hostedUrls },
                }))
                .catch(err => console.warn(`Image re-host failed for listing ${listing.id}: ${err?.message}`));
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

        // Phase 2: Increment seller's total listings count
        if (userId && listingStatus === 'ACTIVE') {
            await this.sellersService.incrementListings(userId);
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
            condition, ulezCompliant, euroStandard,
            vehicleType,
            minBhp, maxBhp,
            sellerType, location, listingType,
            sortBy, search, features,
            page = 1, limit = 20,
        } = filterDto;
        const where: any = { deletedAt: null, status: { in: ['ACTIVE', 'SOLD'] } };

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
        if (condition) where.condition = condition;
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
                    }
                }
            }),
            this.prisma.listing.count({ where }),
        ]);

        return { data, total };
    }

    /**
     * Get currently featured listings (isFeatured = true, not expired)
     * Used for homepage carousel and "Featured" sections
     */
    async getFeaturedListings(limit = 8): Promise<Listing[]> {
        return this.prisma.listing.findMany({
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
        }) as Promise<Listing[]>;
    }

    /**
     * Find a single listing by slug (SEO-friendly) or ID
     */
    async findBySlug(slugOrId: string): Promise<Listing> {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slugOrId);
        
        const listing = await this.prisma.listing.findFirst({
            where: {
                ...(isUuid ? { id: slugOrId } : { slug: slugOrId }),
                deletedAt: null,
            },
            include: {
                seller: {
                    include: {
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
                        dealerProfile: true
                    }
                },
                // Include the most recent offer so the buyer can see their offer status
                offers: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        amount: true,
                        status: true,
                        message: true,
                        buyerId: true,
                        createdAt: true,
                    },
                },
                hpiReport: {
                    select: { isClear: true, purchasedAt: true }
                },
                damageRecords: {
                    orderBy: { createdAt: 'asc' },
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

        return listing;
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
        if (updateListingDto.make) updateData.make = updateListingDto.make;
        if (updateListingDto.model) updateData.model = updateListingDto.model;
        if (updateListingDto.year) updateData.year = updateListingDto.year;
        if (updateListingDto.mileage) updateData.mileage = updateListingDto.mileage;
        if (updateListingDto.vrm) updateData.vrm = updateListingDto.vrm;
        if (updateListingDto.fuelType) updateData.fuelType = mapFuelType(updateListingDto.fuelType);
        if (updateListingDto.transmission) updateData.transmission = mapTransmission(updateListingDto.transmission);
        if (updateListingDto.status) {
            updateData.status = updateListingDto.status === 'ACTIVE' ? 'ACTIVE' :
                updateListingDto.status === 'SOLD' ? 'SOLD' : 'DRAFT';
        }
        if (updateListingDto.listingType) {
            updateData.type = updateListingDto.listingType === 'AUCTION' ? 'AUCTION' : 'CLASSIFIED';
        }
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
            // Enforce the auction-only rule on update too
            const targetType = updateListingDto.listingType
                ? (updateListingDto.listingType === 'AUCTION' ? 'AUCTION' : 'CLASSIFIED')
                : listing.type;
            if ((updateListingDto.writeOffCategory === 'CAT_A' || updateListingDto.writeOffCategory === 'CAT_B') && targetType === 'CLASSIFIED') {
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
    async publishListing(id: string, userId: string): Promise<{ activated: boolean; requiresPayment?: boolean }> {
        const listing = await this.findById(id);

        if (!listing || listing.sellerId !== userId) {
            throw new ForbiddenException('You do not have permission to publish this listing');
        }

        // Already active — nothing to do
        if (listing.status === 'ACTIVE') {
            return { activated: true };
        }

        if (listing.status !== 'DRAFT') {
            throw new BadRequestException('Only DRAFT listings can be published');
        }

        // FREE tier listings have no fee — activate directly
        if (listing.badgeTier === 'FREE') {
            await this.prisma.listing.update({ where: { id }, data: { status: 'ACTIVE' } });
            if (listing.sellerId) await this.sellersService.incrementListings(listing.sellerId);
            return { activated: true };
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
            // Activate and return
            const isPremium = listing.badgeTier === 'PREMIUM';
            await this.prisma.listing.update({
                where: { id },
                data: {
                    status: 'ACTIVE',
                    isFeatured: isPremium,
                    featuredUntil: isPremium ? new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) : null,
                },
            });
            if (listing.sellerId) await this.sellersService.incrementListings(listing.sellerId);
            return { activated: true };
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

        const isPremium = listing.badgeTier === 'PREMIUM';
        await this.prisma.listing.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                isFeatured: isPremium,
                featuredUntil: isPremium ? new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) : null,
            },
        });

        if (listing.sellerId) {
            await this.sellersService.incrementListings(listing.sellerId);
        }

        return { activated: true };
    }

    /**
     * Record a final sale for a listing
     * Marks listing as SOLD and creates a Sale record for earnings tracking
     */
    async recordSale(
        id: string,
        userId: string,
        dto: { soldPrice: number; buyerId?: string; buyerName?: string; buyerEmail?: string },
    ): Promise<Listing> {
        const listing = await this.findById(id);

        // Authorization: Only the seller or authorized dealer staff can mark as sold
        if (listing.sellerId && listing.sellerId !== userId) {
            // Check dealer staff permissions
            const staffMember = await this.prisma.dealerStaff.findFirst({
                where: { 
                    userId, 
                    dealerProfile: { userId: listing.sellerId },
                    isActive: true 
                }
            });
            if (!staffMember) {
                throw new ForbiddenException('You do not have permission to mark this listing as sold');
            }
        }

        if (listing.status === 'SOLD') {
            throw new BadRequestException('This listing is already marked as sold');
        }

        const effectiveSellerId = listing.sellerId || userId;

        // Atomically set listing SOLD and upsert the Sale record
        const updated = await this.prisma.$transaction(async (tx) => {
            const updatedListing = await tx.listing.update({
                where: { id },
                data: { status: 'SOLD' },
            });

            await tx.sale.upsert({
                where: { listingId: id },
                create: {
                    listingId: id,
                    sellerId: effectiveSellerId,
                    buyerId: dto.buyerId ?? null,
                    buyerName: dto.buyerName ?? null,
                    buyerEmail: dto.buyerEmail ?? null,
                    soldPrice: dto.soldPrice,
                },
                update: {
                    sellerId: effectiveSellerId,
                    buyerId: dto.buyerId ?? null,
                    buyerName: dto.buyerName ?? null,
                    buyerEmail: dto.buyerEmail ?? null,
                    soldPrice: dto.soldPrice,
                },
            });

            return updatedListing;
        });

        // Increment seller profile stats outside the transaction — a failure here
        // should never roll back the sale that was just committed.
        if (effectiveSellerId) {
            this.sellersService.incrementSales(effectiveSellerId).catch((err) => {
                console.error(`recordSale: incrementSales failed for ${effectiveSellerId}:`, err?.message);
            });
        }

        return updated;
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

        const totalRevenue = Number(revenueAgg._sum.soldPrice ?? 0);

        return {
            sales,
            totalRevenue,
            totalSales,
            page,
            totalPages: Math.ceil(totalSales / limit),
        };
    }
}
