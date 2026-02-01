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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const listings_service_1 = require("./listings.service");
const create_listing_dto_1 = require("./dto/create-listing.dto");
const update_listing_dto_1 = require("./dto/update-listing.dto");
const listing_filter_dto_1 = require("./dto/listing-filter.dto");
const response_dto_1 = require("./dto/response.dto");
function UserId() {
    return function (target, propertyKey, parameterIndex) {
    };
}
let ListingsController = class ListingsController {
    listingsService;
    constructor(listingsService) {
        this.listingsService = listingsService;
    }
    async create(createListingDto) {
        const listing = await this.listingsService.create(createListingDto);
        return new response_dto_1.StandardResponse(listing);
    }
    async findAll(filterDto) {
        const { data, total } = await this.listingsService.findAll(filterDto);
        const page = filterDto.page || 1;
        const limit = filterDto.limit || 20;
        return new response_dto_1.PaginatedResponse(data, total, page, limit);
    }
    async findBySlug(slug) {
        const listing = await this.listingsService.findBySlug(slug);
        return new response_dto_1.StandardResponse(listing);
    }
    async update(id, updateListingDto) {
        const userId = 'temp-user-id-for-testing';
        const listing = await this.listingsService.update(id, userId, updateListingDto);
        return new response_dto_1.StandardResponse(listing);
    }
    async remove(id) {
        const userId = 'temp-user-id-for-testing';
        const listing = await this.listingsService.softDelete(id, userId);
        return new response_dto_1.StandardResponse(listing);
    }
};
exports.ListingsController = ListingsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a new listing',
        description: 'Creates a new vehicle listing. Requires authentication.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Listing created successfully',
        type: response_dto_1.StandardResponse,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Invalid input data',
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Unauthorized - Authentication required',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_listing_dto_1.CreateListingDto]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all listings',
        description: 'Retrieves all active listings with optional filtering and pagination',
    }),
    (0, swagger_1.ApiQuery)({ name: 'minPrice', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'maxPrice', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'make', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'year', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, example: 20 }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of listings with pagination metadata',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [listing_filter_dto_1.ListingFilterDto]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':slug'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get listing by slug',
        description: 'Retrieves a single listing by its SEO-friendly slug',
    }),
    (0, swagger_1.ApiParam)({
        name: 'slug',
        description: 'URL-friendly slug of the listing',
        example: 'audi-q7-2015-x8d2',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Listing found',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Listing not found',
    }),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "findBySlug", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Update a listing',
        description: 'Updates a listing. Requires authentication and ownership.',
    }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        description: 'UUID of the listing',
        example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Listing updated successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: 403,
        description: 'Forbidden - You do not own this listing',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Listing not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_listing_dto_1.UpdateListingDto]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete a listing (soft delete)',
        description: 'Soft deletes a listing by setting deletedAt. Requires authentication and ownership.',
    }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        description: 'UUID of the listing',
        example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Listing deleted successfully',
    }),
    (0, swagger_1.ApiResponse)({
        status: 403,
        description: 'Forbidden - You do not own this listing',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Listing not found',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "remove", null);
exports.ListingsController = ListingsController = __decorate([
    (0, swagger_1.ApiTags)('Listings'),
    (0, common_1.Controller)('listings'),
    __metadata("design:paramtypes", [listings_service_1.ListingsService])
], ListingsController);
//# sourceMappingURL=listings.controller.js.map