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
exports.PaginatedResponse = exports.StandardResponse = void 0;
const swagger_1 = require("@nestjs/swagger");
class StandardResponse {
    success;
    data;
    timestamp;
    constructor(data, success = true) {
        this.success = success;
        this.data = data;
        this.timestamp = new Date().toISOString();
    }
}
exports.StandardResponse = StandardResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StandardResponse.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Object)
], StandardResponse.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-02-01T00:45:00.000Z' }),
    __metadata("design:type", String)
], StandardResponse.prototype, "timestamp", void 0);
class PaginatedResponse {
    success;
    data;
    pagination;
    timestamp;
    constructor(data, total, page, limit, success = true) {
        this.success = success;
        this.data = data;
        this.pagination = {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
        this.timestamp = new Date().toISOString();
    }
}
exports.PaginatedResponse = PaginatedResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PaginatedResponse.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Array)
], PaginatedResponse.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: {
            total: 100,
            page: 1,
            limit: 20,
            totalPages: 5,
        },
    }),
    __metadata("design:type", Object)
], PaginatedResponse.prototype, "pagination", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-02-01T00:45:00.000Z' }),
    __metadata("design:type", String)
], PaginatedResponse.prototype, "timestamp", void 0);
//# sourceMappingURL=response.dto.js.map