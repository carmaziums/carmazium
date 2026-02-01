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
exports.CreateListingDto = exports.Transmission = exports.FuelType = exports.ListingStatus = exports.ListingType = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var ListingType;
(function (ListingType) {
    ListingType["AUCTION"] = "AUCTION";
    ListingType["CLASSIFIED"] = "CLASSIFIED";
})(ListingType || (exports.ListingType = ListingType = {}));
var ListingStatus;
(function (ListingStatus) {
    ListingStatus["DRAFT"] = "DRAFT";
    ListingStatus["ACTIVE"] = "ACTIVE";
    ListingStatus["SOLD"] = "SOLD";
})(ListingStatus || (exports.ListingStatus = ListingStatus = {}));
var FuelType;
(function (FuelType) {
    FuelType["PETROL"] = "PETROL";
    FuelType["DIESEL"] = "DIESEL";
    FuelType["ELECTRIC"] = "ELECTRIC";
    FuelType["HYBRID"] = "HYBRID";
    FuelType["PLUGIN_HYBRID"] = "PLUGIN_HYBRID";
})(FuelType || (exports.FuelType = FuelType = {}));
var Transmission;
(function (Transmission) {
    Transmission["MANUAL"] = "MANUAL";
    Transmission["AUTOMATIC"] = "AUTOMATIC";
    Transmission["SEMI_AUTOMATIC"] = "SEMI_AUTOMATIC";
})(Transmission || (exports.Transmission = Transmission = {}));
class CreateListingDto {
    title;
    price;
    mileage;
    year;
    vrm;
    make;
    model;
    description;
    images;
    listingType;
    status;
    fuelType;
    transmission;
    color;
    doors;
    seats;
    engineSize;
    bhp;
    features;
}
exports.CreateListingDto = CreateListingDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Title of the listing',
        example: 'Audi Q7 2015 S-Line Quattro',
        minLength: 5,
        maxLength: 200,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(5, 200),
    __metadata("design:type", String)
], CreateListingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Price of the vehicle in GBP',
        example: 25000.99,
        type: 'number',
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateListingDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Mileage in miles',
        example: 45000,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateListingDto.prototype, "mileage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Year of manufacture',
        example: 2015,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1900),
    (0, class_validator_1.Max)(new Date().getFullYear() + 1),
    __metadata("design:type", Number)
], CreateListingDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Vehicle Registration Mark (VRM)',
        example: 'AB12 CDE',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(2, 15),
    __metadata("design:type", String)
], CreateListingDto.prototype, "vrm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Make of the vehicle',
        example: 'Audi',
        required: false,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "make", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Model of the vehicle',
        example: 'Q7',
        required: false,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "model", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Detailed description of the vehicle',
        example: 'Excellent condition, full service history...',
        required: false,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Array of image URLs from Supabase Storage (ensure URLs are from your Supabase bucket)',
        example: [
            'https://your-project.supabase.co/storage/v1/object/public/listings/abc123.jpg',
            'https://your-project.supabase.co/storage/v1/object/public/listings/def456.jpg',
        ],
        type: [String],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsUrl)({}, { each: true, message: 'Each image must be a valid URL' }),
    __metadata("design:type", Array)
], CreateListingDto.prototype, "images", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Type of listing',
        enum: ListingType,
        example: ListingType.CLASSIFIED,
    }),
    (0, class_validator_1.IsEnum)(ListingType),
    __metadata("design:type", String)
], CreateListingDto.prototype, "listingType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Status of the listing',
        enum: ListingStatus,
        example: ListingStatus.DRAFT,
        required: false,
        default: ListingStatus.DRAFT,
    }),
    (0, class_validator_1.IsEnum)(ListingStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fuel type of the vehicle',
        enum: FuelType,
        example: FuelType.DIESEL,
        required: false,
    }),
    (0, class_validator_1.IsEnum)(FuelType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "fuelType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transmission type',
        enum: Transmission,
        example: Transmission.AUTOMATIC,
        required: false,
    }),
    (0, class_validator_1.IsEnum)(Transmission),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "transmission", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Exterior color of the vehicle',
        example: 'Misano Blue',
        required: false,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "color", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of doors',
        example: 5,
        required: false,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2),
    (0, class_validator_1.Max)(8),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateListingDto.prototype, "doors", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of seats',
        example: 7,
        required: false,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateListingDto.prototype, "seats", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Engine size in cc',
        example: 2993,
        required: false,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateListingDto.prototype, "engineSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Engine power in BHP',
        example: 258,
        required: false,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateListingDto.prototype, "bhp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'List of vehicle features',
        example: ['Sunroof', 'Heated Seats', 'Navigation'],
        required: false,
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateListingDto.prototype, "features", void 0);
//# sourceMappingURL=create-listing.dto.js.map