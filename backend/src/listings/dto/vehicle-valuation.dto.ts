import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
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

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    @IsOptional()
    exteriorGrade?: number;

    @IsString()
    @IsOptional()
    @MaxLength(60)
    serviceHistory?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    owners?: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(10)
    @IsOptional()
    numberOfKeys?: number;

    @Transform(({ value }) =>
        value === true ? true :
        value === false ? false :
        value === 'true' ? true :
        value === 'false' ? false :
        value,
    )
    @IsBoolean()
    @IsOptional()
    ulezCompliant?: boolean;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    euroStandard?: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(10)
    @IsOptional()
    doors?: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    @IsOptional()
    seats?: number;

    @Transform(({ value }) =>
        Array.isArray(value)
            ? value
            : typeof value === 'string'
                ? value.split('|').map((item: string) => item.trim()).filter(Boolean)
                : undefined,
    )
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(80, { each: true })
    @IsOptional()
    features?: string[];

    @IsString()
    @IsOptional()
    @MaxLength(20)
    writeOffCategory?: string;

    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    @IsOptional()
    isImported?: boolean;

    @IsUUID()
    @IsOptional()
    excludeListingId?: string;
}
