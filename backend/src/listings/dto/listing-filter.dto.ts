import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
        description: 'Filter by year',
        example: 2015,
    })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    year?: number;

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
