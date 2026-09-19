import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export class VehicleValuationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    make: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    model: string;

    @Type(() => Number)
    @IsInt()
    @Min(1950)
    @Max(2035)
    year: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(1_500_000)
    mileage: number;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    variant?: string;

    @IsString()
    @IsOptional()
    @MaxLength(40)
    fuelType?: string;

    @IsString()
    @IsOptional()
    @MaxLength(40)
    transmission?: string;

    @IsString()
    @IsOptional()
    @MaxLength(40)
    condition?: string;

    @IsString()
    @IsOptional()
    @MaxLength(60)
    serviceHistory?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    owners?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    writeOffCategory?: string;

    @IsBoolean()
    @IsOptional()
    isImported?: boolean;

    @IsUUID()
    @IsOptional()
    excludeListingId?: string;
}
