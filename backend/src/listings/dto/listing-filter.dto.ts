import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { FuelType, TransmissionType, BodyType } from '@prisma/client';

export class ListingFilterDto {
    @ApiPropertyOptional({
        description: 'Minimum price filter',
        example: 10000,
    })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    @Min(0)
    minPrice?: number;

    @ApiPropertyOptional({
        description: 'Maximum price filter',
        example: 50000,
    })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    @Min(0)
    maxPrice?: number;

    @ApiPropertyOptional({
        description: 'Filter by vehicle make',
        example: 'Audi',
    })
    @IsString()
    @IsOptional()
    make?: string;

    @ApiPropertyOptional({
        description: 'Filter by vehicle model',
        example: 'Q7',
    })
    @IsString()
    @IsOptional()
    model?: string;

    @ApiPropertyOptional({
        description: 'Filter by minimum year',
        example: 2015,
    })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    year?: number;

    @ApiPropertyOptional({
        description: 'Filter by fuel type',
        enum: ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'PLUGIN_HYBRID'],
    })
    @IsEnum(FuelType)
    @IsOptional()
    fuelType?: FuelType;

    @ApiPropertyOptional({
        description: 'Filter by transmission type',
        enum: ['MANUAL', 'AUTOMATIC', 'CVT', 'SEMI_AUTOMATIC'],
    })
    @IsEnum(TransmissionType)
    @IsOptional()
    transmission?: TransmissionType;

    @ApiPropertyOptional({
        description: 'Filter by body type',
        enum: ['SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'ESTATE', 'CROSSOVER', 'SPORTS_CAR', 'MINIVAN', 'PICKUP_TRUCK', 'STATION_WAGON', 'MPV', 'VAN'],
    })
    @IsEnum(BodyType)
    @IsOptional()
    bodyType?: BodyType;

    @ApiPropertyOptional({
        description: 'Sort order: newest, price_asc, price_desc, mileage_asc',
        example: 'newest',
    })
    @IsString()
    @IsOptional()
    sortBy?: string;

    @ApiPropertyOptional({
        description: 'Search query for title/make/model',
        example: 'BMW M4',
    })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({
        description: 'Page number (1-indexed)',
        example: 1,
        default: 1,
    })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 20,
        default: 20,
    })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @Min(1)
    limit?: number = 20;
}
