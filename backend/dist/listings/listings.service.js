"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const create_listing_dto_1 = require("./dto/create-listing.dto");
const crypto_1 = require("crypto");
const mapFuelType = (fuel) => {
    if (!fuel)
        return null;
    const map = {
        [create_listing_dto_1.FuelType.PETROL]: 'PETROL',
        [create_listing_dto_1.FuelType.DIESEL]: 'DIESEL',
        [create_listing_dto_1.FuelType.ELECTRIC]: 'ELECTRIC',
        [create_listing_dto_1.FuelType.HYBRID]: 'HYBRID',
        [create_listing_dto_1.FuelType.PLUGIN_HYBRID]: 'PLUGIN_HYBRID',
    };
    return map[fuel];
};
const mapTransmission = (trans) => {
    if (!trans)
        return null;
    const map = {
        [create_listing_dto_1.Transmission.MANUAL]: 'MANUAL',
        [create_listing_dto_1.Transmission.AUTOMATIC]: 'AUTOMATIC',
        [create_listing_dto_1.Transmission.SEMI_AUTOMATIC]: 'SEMI_AUTOMATIC',
    };
    return map[trans];
};
let ListingsService = class ListingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    generateSlug(title) {
        const baseSlug = title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        const uniqueSuffix = (0, crypto_1.randomBytes)(2).toString('hex');
        return `${baseSlug}-${uniqueSuffix}`;
    }
    async create(createListingDto, userId) {
        const slug = this.generateSlug(createListingDto.title);
        const listingType = createListingDto.listingType === 'AUCTION' ? 'AUCTION' : 'CLASSIFIED';
        const listingStatus = createListingDto.status === 'ACTIVE' ? 'ACTIVE' :
            createListingDto.status === 'SOLD' ? 'SOLD' : 'DRAFT';
        const listing = await this.prisma.listing.create({
            data: {
                title: createListingDto.title,
                price: createListingDto.price,
                images: createListingDto.images,
                type: listingType,
                status: listingStatus,
                description: createListingDto.description ?? null,
                slug,
                make: createListingDto.make ?? null,
                model: createListingDto.model ?? null,
                year: createListingDto.year,
                mileage: createListingDto.mileage,
                vrm: createListingDto.vrm ?? null,
                fuelType: mapFuelType(createListingDto.fuelType),
                transmission: mapTransmission(createListingDto.transmission),
                color: createListingDto.color ?? null,
                doors: createListingDto.doors ?? null,
                seats: createListingDto.seats ?? null,
                engineSize: createListingDto.engineSize ?? null,
                bhp: createListingDto.bhp ?? null,
                features: createListingDto.features ?? undefined,
                sellerId: userId ?? null,
            },
        });
        return listing;
    }
    async findAll(filterDto) {
        const { minPrice, maxPrice, make, year, page = 1, limit = 20 } = filterDto;
        const where = {
            deletedAt: null,
        };
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.price = {};
            if (minPrice !== undefined)
                where.price.gte = minPrice;
            if (maxPrice !== undefined)
                where.price.lte = maxPrice;
        }
        if (make) {
            where.make = {
                contains: make,
                mode: 'insensitive',
            };
        }
        if (year) {
            where.year = year;
        }
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.listing.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            this.prisma.listing.count({ where }),
        ]);
        return { data, total };
    }
    async findBySlug(slug) {
        const listing = await this.prisma.listing.findFirst({
            where: {
                slug,
                deletedAt: null,
            },
        });
        if (!listing) {
            throw new common_1.NotFoundException(`Listing with slug "${slug}" not found`);
        }
        return listing;
    }
    async findById(id) {
        const listing = await this.prisma.listing.findUnique({
            where: { id },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing with ID "${id}" not found`);
        }
        return listing;
    }
    async update(id, userId, updateListingDto) {
        const listing = await this.findById(id);
        if (listing.sellerId && listing.sellerId !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to update this listing');
        }
        const updateData = {};
        if (updateListingDto.title)
            updateData.title = updateListingDto.title;
        if (updateListingDto.price)
            updateData.price = updateListingDto.price;
        if (updateListingDto.description !== undefined)
            updateData.description = updateListingDto.description;
        if (updateListingDto.images)
            updateData.images = updateListingDto.images;
        if (updateListingDto.make)
            updateData.make = updateListingDto.make;
        if (updateListingDto.model)
            updateData.model = updateListingDto.model;
        if (updateListingDto.year)
            updateData.year = updateListingDto.year;
        if (updateListingDto.mileage)
            updateData.mileage = updateListingDto.mileage;
        if (updateListingDto.vrm)
            updateData.vrm = updateListingDto.vrm;
        if (updateListingDto.fuelType)
            updateData.fuelType = mapFuelType(updateListingDto.fuelType);
        if (updateListingDto.transmission)
            updateData.transmission = mapTransmission(updateListingDto.transmission);
        if (updateListingDto.status) {
            updateData.status = updateListingDto.status === 'ACTIVE' ? 'ACTIVE' :
                updateListingDto.status === 'SOLD' ? 'SOLD' : 'DRAFT';
        }
        if (updateListingDto.listingType) {
            updateData.type = updateListingDto.listingType === 'AUCTION' ? 'AUCTION' : 'CLASSIFIED';
        }
        const updatedListing = await this.prisma.listing.update({
            where: { id },
            data: updateData,
        });
        return updatedListing;
    }
    async softDelete(id, userId) {
        const listing = await this.findById(id);
        if (listing.sellerId && listing.sellerId !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to delete this listing');
        }
        const deletedListing = await this.prisma.listing.update({
            where: { id },
            data: {
                deletedAt: new Date(),
            },
        });
        return deletedListing;
    }
};
exports.ListingsService = ListingsService;
exports.ListingsService = ListingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ListingsService);
//# sourceMappingURL=listings.service.js.map