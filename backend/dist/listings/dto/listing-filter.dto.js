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
exports.ListingFilterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class ListingFilterDto {
    minPrice;
    maxPrice;
    make;
    year;
    page = 1;
    limit = 20;
}
exports.ListingFilterDto = ListingFilterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Minimum price filter',
        example: 10000,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ListingFilterDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Maximum price filter',
        example: 50000,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ListingFilterDto.prototype, "maxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filter by vehicle make',
        example: 'Audi',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListingFilterDto.prototype, "make", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filter by year',
        example: 2015,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ListingFilterDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Page number (1-indexed)',
        example: 1,
        default: 1,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListingFilterDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Number of items per page',
        example: 20,
        default: 20,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListingFilterDto.prototype, "limit", void 0);
//# sourceMappingURL=listing-filter.dto.js.map