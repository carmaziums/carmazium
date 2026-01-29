import { IsString, IsInt, IsEnum, IsNumber, IsArray, IsOptional, Min, Max, IsUUID } from 'class-validator';
import { FuelType, Transmission, ListingType } from '@prisma/client';

export class CreateListingDto {
    @IsString()
    make: string;

    @IsString()
    model: string;

    @IsInt()
    @Min(1900)
    @Max(new Date().getFullYear() + 1)
    year: number;

    @IsInt()
    @Min(0)
    mileage: number;

    @IsEnum(FuelType)
    fuelType: FuelType;

    @IsEnum(Transmission)
    transmission: Transmission;

    @IsString()
    vrm: string;

    @IsNumber()
    @Min(0)
    price: number;

    @IsString()
    @IsOptional()
    currency?: string;

    @IsEnum(ListingType)
    listingType: ListingType;

    @IsArray()
    @IsString({ each: true })
    images: string[];
}
