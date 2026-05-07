import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min, IsEnum, IsBoolean } from 'class-validator';
import {
    FuelType,
    Transmission as TransmissionType,
    BodyType,
    VehicleCondition,
    EuroStandard,
    VehicleType,
} from './create-listing.dto';

export class ListingFilterDto {
    // ─── Price ────────────────────────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Minimum price (GBP)', example: 5000 })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    @Min(0)
    minPrice?: number;

    @ApiPropertyOptional({ description: 'Maximum price (GBP)', example: 50000 })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    @Min(0)
    maxPrice?: number;

    // ─── Make / Model ─────────────────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Filter by vehicle make', example: 'Audi' })
    @IsString()
    @IsOptional()
    make?: string;

    @ApiPropertyOptional({ description: 'Filter by vehicle model', example: 'Q7' })
    @IsString()
    @IsOptional()
    model?: string;

    // ─── Year ─────────────────────────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Minimum manufacture year', example: 2015 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    minYear?: number;

    @ApiPropertyOptional({ description: 'Maximum manufacture year', example: 2024 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    maxYear?: number;

    /** @deprecated Use minYear instead */
    @ApiPropertyOptional({ description: 'Alias for minYear (deprecated — use minYear)', example: 2015 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    year?: number;

    // ─── Mileage ──────────────────────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Minimum mileage', example: 0 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(0)
    minMileage?: number;

    @ApiPropertyOptional({ description: 'Maximum mileage', example: 100000 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(0)
    maxMileage?: number;

    // ─── Specs ────────────────────────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Filter by fuel type', enum: FuelType })
    @IsEnum(FuelType)
    @IsOptional()
    fuelType?: FuelType;

    @ApiPropertyOptional({ description: 'Filter by transmission type', enum: TransmissionType })
    @IsEnum(TransmissionType)
    @IsOptional()
    transmission?: TransmissionType;

    @ApiPropertyOptional({ description: 'Filter by body type', enum: BodyType })
    @IsEnum(BodyType)
    @IsOptional()
    bodyType?: BodyType;

    @ApiPropertyOptional({ description: 'Filter by exterior colour (case-insensitive contains)', example: 'white' })
    @IsString()
    @IsOptional()
    color?: string;

    @ApiPropertyOptional({ description: 'Minimum number of doors', example: 4 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(2)
    minDoors?: number;

    @ApiPropertyOptional({ description: 'Minimum number of seats', example: 5 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(1)
    minSeats?: number;

    // ─── Engine & CO₂ ─────────────────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Minimum engine capacity (cc)', example: 1000 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(0)
    minEngine?: number;

    @ApiPropertyOptional({ description: 'Maximum engine capacity (cc)', example: 5000 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(0)
    maxEngine?: number;

    @ApiPropertyOptional({ description: 'Maximum CO₂ emissions (g/km)', example: 150 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(0)
    maxCo2?: number;

    // ─── Condition & Compliance ───────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Filter by vehicle condition', enum: VehicleCondition })
    @IsEnum(VehicleCondition)
    @IsOptional()
    condition?: VehicleCondition;

    @ApiPropertyOptional({ description: 'Filter by ULEZ / CAZ compliance', example: true })
    @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
    @IsBoolean()
    @IsOptional()
    ulezCompliant?: boolean;

    @ApiPropertyOptional({ description: 'Filter by Euro emission standard', enum: EuroStandard })
    @IsEnum(EuroStandard)
    @IsOptional()
    euroStandard?: EuroStandard;

    // ─── Vehicle Type ────────────────────────────────────────────────────────
    @ApiPropertyOptional({ description: 'Filter by vehicle type (car, motorcycle, HGV)', enum: VehicleType })
    @IsEnum(VehicleType)
    @IsOptional()
    vehicleType?: VehicleType;

    // ─── Sort & Pagination ─────────────────────────────────────────────────────
    @ApiPropertyOptional({
        description: 'Sort order: newest | price_asc | price_desc | mileage_asc | year_desc',
        example: 'newest',
    })
    @IsString()
    @IsOptional()
    sortBy?: string;

    @ApiPropertyOptional({ description: 'Full-text search across title, make, model', example: 'BMW M4' })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ description: 'Page number (1-indexed)', example: 1, default: 1 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Results per page', example: 20, default: 20 })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(1)
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Include SOLD listings in the result set (used by /listings/my for offer dashboards)',
        example: false,
    })
    @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
    @IsBoolean()
    @IsOptional()
    includeSold?: boolean;
}
