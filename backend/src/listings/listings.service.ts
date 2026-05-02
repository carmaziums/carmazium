import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
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
     * Create a new listing
     * Auto-generates slug and saves Supabase image URLs
     */
    async create(createListingDto: CreateListingDto, userId?: string): Promise<Listing> {
        const slug = this.generateSlug(createListingDto.title);

        const listingType: ListingType = createListingDto.listingType === 'AUCTION' ? 'AUCTION' : 'CLASSIFIED';
        const listingStatus: ListingStatus = createListingDto.status === 'ACTIVE' ? 'ACTIVE' :
            createListingDto.status === 'SOLD' ? 'SOLD' : 'DRAFT';

        // Badge tier — default FREE
        const badgeTier = createListingDto.badgeTier ?? 'FREE';
        const isPremium = badgeTier === 'PREMIUM';

        // Block imported vehicles
        if (createListingDto.isImported) {
            throw new BadRequestException('Imported vehicles cannot be listed on CarMazium.');
        }

        // Re-host any external images
        let finalImages: string[] = [];
        if (createListingDto.images && createListingDto.images.length > 0) {
            finalImages = await Promise.all(createListingDto.images.map(img => this.rehostImage(img)));
        }

        const listing = await this.prisma.listing.create({
            data: {
                title: createListingDto.title,
                price: createListingDto.price,
                priceMin: createListingDto.priceMin ?? null,
                priceMax: createListingDto.priceMax ?? null,
                images: finalImages,
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
            },
        });

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
            fuelType, transmission, bodyType,
            color, minDoors, minSeats,
            minEngine, maxEngine, maxCo2,
            condition, ulezCompliant, euroStandard,
            vehicleType,
            sortBy, search,
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
        if (fuelType) where.fuelType = fuelType;
        if (transmission) where.transmission = transmission;
        if (bodyType) where.bodyType = bodyType;
        if (condition) where.condition = condition;
        if (euroStandard) where.euroStandard = euroStandard;
        if (vehicleType) where.vehicleType = vehicleType;

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
            },
        }) as Promise<Listing[]>;
    }

    /**
     * Find a single listing by slug (SEO-friendly)
     */
    async findBySlug(slug: string): Promise<Listing> {
        const listing = await this.prisma.listing.findFirst({
            where: {
                slug,
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
            }
        });

        if (!listing) {
            throw new NotFoundException(`Listing with slug "${slug}" not found`);
        }

        // Fire-and-forget strictly incrementing the viewCount logic
        this.prisma.listing.update({
            where: { id: listing.id },
            data: { viewCount: { increment: 1 } },
        }).catch(err => console.error(`Failed to increment views for ${slug}:`, err));

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

        // Update the listing
        const updatedListing = await this.prisma.listing.update({
            where: { id },
            data: updateData,
        });

        // Phase 2: If status changed to ACTIVE, increment seller's listing count
        if (updateData.status === 'ACTIVE' && updatedListing.sellerId && listing.status !== 'ACTIVE') {
            await this.sellersService.incrementListings(updatedListing.sellerId);
        }

        return updatedListing;
    }

    /**
     * Update listing status
     * Allows specific transitions (Draft -> Active -> Sold/Withdrawn)
     */
    async updateStatus(
        id: string,
        userId: string,
        status: ListingStatus,
    ): Promise<Listing> {
        const listing = await this.findById(id);

        if (listing.sellerId && listing.sellerId !== userId) {
            throw new ForbiddenException('You do not have permission to update this listing');
        }

        const updated = await this.prisma.listing.update({
            where: { id },
            data: { status },
        });

        // Phase 2: Increment listing count if status changed TO Active from something else
        if (status === 'ACTIVE' && updated.sellerId && listing.status !== 'ACTIVE') {
            await this.sellersService.incrementListings(updated.sellerId);
        }

        // Phase 2: Increment sales count if marked as SOLD
        if (status === 'SOLD' && updated.sellerId && listing.status !== 'SOLD') {
            await this.sellersService.incrementSales(updated.sellerId);
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
     */
    async findMyListings(sellerId: string, filterDto?: ListingFilterDto): Promise<{ data: Listing[]; total: number }> {
        const page = filterDto?.page || 1;
        const limit = filterDto?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {
            sellerId,
            deletedAt: null,
            status: { not: 'SOLD' },
        };

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
            }),
            this.prisma.listing.count({ where }),
        ]);

        return { data, total };
    }

    /**
     * Get seller dashboard statistics
     */
    async getSellerStats(sellerId: string): Promise<{
        totalListings: number;
        activeListings: number;
        soldListings: number;
        draftListings: number;
        totalViews: number;
        totalRevenue: number;
    }> {
        const baseWhere = { sellerId, deletedAt: null };

        const [totalListings, activeListings, soldListings, draftListings, viewsAndRevenue] = await Promise.all([
            this.prisma.listing.count({ where: baseWhere }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'SOLD' } }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'DRAFT' } }),
            this.prisma.listing.aggregate({
                where: baseWhere,
                _sum: { viewCount: true, price: true },
            }),
        ]);

        // Calculate total revenue from sold listings
        const soldRevenue = await this.prisma.listing.aggregate({
            where: { ...baseWhere, status: 'SOLD' },
            _sum: { price: true },
        });

        return {
            totalListings,
            activeListings,
            soldListings,
            draftListings,
            totalViews: viewsAndRevenue._sum.viewCount || 0,
            totalRevenue: Number(soldRevenue._sum.price || 0),
        };
    }

    /**
     * Get seller performance analytics
     * Returns metrics + per-listing view data for charts
     */
    async getSellerPerformance(sellerId: string) {
        const baseWhere = { sellerId, deletedAt: null };

        const [totalListings, soldCount, viewsAggregate, recentListings] = await Promise.all([
            this.prisma.listing.count({ where: baseWhere }),
            this.prisma.listing.count({ where: { ...baseWhere, status: 'SOLD' } }),
            this.prisma.listing.aggregate({
                where: baseWhere,
                _sum: { viewCount: true, price: true },
            }),
            this.prisma.listing.findMany({
                where: baseWhere,
                select: { id: true, title: true, viewCount: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 12,
            }),
        ]);

        const soldRevenue = await this.prisma.listing.aggregate({
            where: { ...baseWhere, status: 'SOLD' },
            _sum: { price: true },
        });

        const totalViews = viewsAggregate._sum.viewCount || 0;
        const conversionRate = totalViews > 0
            ? ((soldCount / totalViews) * 100).toFixed(1)
            : '0.0';

        return {
            totalRevenue: Number(soldRevenue._sum.price || 0),
            totalViews,
            totalListings,
            conversionRate: parseFloat(conversionRate),
            recentListingViews: recentListings.map(l => ({
                id: l.id,
                title: l.title,
                views: l.viewCount,
                date: l.createdAt,
            })),
        };
    }
}
