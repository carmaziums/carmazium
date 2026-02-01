import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsNumber,
    IsPositive,
    IsInt,
    Min,
    Max,
    IsArray,
    IsUrl,
    IsOptional,
    Length,
} from 'class-validator';
import { Type } from 'class-transformer';

// Enums matching Prisma schema
export enum ListingType {
    AUCTION = 'AUCTION',
    CLASSIFIED = 'CLASSIFIED',
}

export enum ListingStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    SOLD = 'SOLD',
}

export enum FuelType {
    PETROL = 'PETROL',
    DIESEL = 'DIESEL',
    ELECTRIC = 'ELECTRIC',
    HYBRID = 'HYBRID',
    PLUGIN_HYBRID = 'PLUGIN_HYBRID',
}

export enum Transmission {
    MANUAL = 'MANUAL',
    AUTOMATIC = 'AUTOMATIC',
    SEMI_AUTOMATIC = 'SEMI_AUTOMATIC',
}

export class CreateListingDto {
    @ApiProperty({
        description: 'Title of the listing',
        example: 'Audi Q7 2015 S-Line Quattro',
        minLength: 5,
        maxLength: 200,
    })
    @IsString()
    @IsNotEmpty()
    @Length(5, 200)
    title: string;

    @ApiProperty({
        description: 'Price of the vehicle in GBP',
        example: 25000.99,
        type: 'number',
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    price: number;

    @ApiProperty({
        description: 'Mileage in miles',
        example: 45000,
    })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    mileage: number;

    @ApiProperty({
        description: 'Year of manufacture',
        example: 2015,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1900)
    @Max(new Date().getFullYear() + 1)
    year: number;

    @ApiProperty({
        description: 'Vehicle Registration Mark (VRM)',
        example: 'AB12 CDE',
    })
    @IsString()
    @IsNotEmpty()
    @Length(2, 15)
    vrm: string;

    @ApiProperty({
        description: 'Make of the vehicle',
        example: 'Audi',
        required: false,
    })
    @IsString()
    @IsOptional()
    make?: string;

    @ApiProperty({
        description: 'Model of the vehicle',
        example: 'Q7',
        required: false,
    })
    @IsString()
    @IsOptional()
    model?: string;

    @ApiProperty({
        description: 'Detailed description of the vehicle',
        example: 'Excellent condition, full service history...',
        required: false,
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        description:
            'Array of image URLs from Supabase Storage (ensure URLs are from your Supabase bucket)',
        example: [
            'https://your-project.supabase.co/storage/v1/object/public/listings/abc123.jpg',
            'https://your-project.supabase.co/storage/v1/object/public/listings/def456.jpg',
        ],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
    images: string[];

    @ApiProperty({
        description: 'Type of listing',
        enum: ListingType,
        example: ListingType.CLASSIFIED,
    })
    @IsEnum(ListingType)
    listingType: ListingType;

    @ApiProperty({
        description: 'Status of the listing',
        enum: ListingStatus,
        example: ListingStatus.DRAFT,
        required: false,
        default: ListingStatus.DRAFT,
    })
    @IsEnum(ListingStatus)
    @IsOptional()
    status?: ListingStatus;

    @ApiProperty({
        description: 'Fuel type of the vehicle',
        enum: FuelType,
        example: FuelType.DIESEL,
        required: false,
    })
    @IsEnum(FuelType)
    @IsOptional()
    fuelType?: FuelType;

    @ApiProperty({
        description: 'Transmission type',
        enum: Transmission,
        example: Transmission.AUTOMATIC,
        required: false,
    })
    @IsEnum(Transmission)
    @IsOptional()
    transmission?: Transmission;

    @ApiProperty({
        description: 'Exterior color of the vehicle',
        example: 'Misano Blue',
        required: false,
    })
    @IsString()
    @IsOptional()
    color?: string;

    @ApiProperty({
        description: 'Number of doors',
        example: 5,
        required: false,
    })
    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(8)
    @IsOptional()
    doors?: number;

    @ApiProperty({
        description: 'Number of seats',
        example: 7,
        required: false,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    @IsOptional()
    seats?: number;

    @ApiProperty({
        description: 'Engine size in cc',
        example: 2993,
        required: false,
    })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    engineSize?: number;

    @ApiProperty({
        description: 'Engine power in BHP',
        example: 258,
        required: false,
    })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    bhp?: number;

    @ApiProperty({
        description: 'List of vehicle features',
        example: ['Sunroof', 'Heated Seats', 'Navigation'],
        required: false,
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    features?: string[];
}
