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
    IsBoolean,
    Length,
    Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Enums (mirror Prisma schema) ───────────────────────────────────────────

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

export enum BodyType {
    SEDAN = 'SEDAN',
    SUV = 'SUV',
    HATCHBACK = 'HATCHBACK',
    COUPE = 'COUPE',
    CONVERTIBLE = 'CONVERTIBLE',
    ESTATE = 'ESTATE',
    CROSSOVER = 'CROSSOVER',
    SPORTS_CAR = 'SPORTS_CAR',
    MINIVAN = 'MINIVAN',
    PICKUP_TRUCK = 'PICKUP_TRUCK',
    STATION_WAGON = 'STATION_WAGON',
    MPV = 'MPV',
    VAN = 'VAN',
}

/** Standard quality tiers + UK insurance write-off categories */
export enum VehicleCondition {
    EXCELLENT = 'EXCELLENT',
    GOOD = 'GOOD',
    FAIR = 'FAIR',
    POOR = 'POOR',
    /** Structural damage, repaired — can be re-registered */
    CAT_S = 'CAT_S',
    /** Non-structural damage, repaired — can be re-registered */
    CAT_N = 'CAT_N',
    /** Structural damage, not repaired — cannot be re-registered */
    CAT_C = 'CAT_C',
    /** Non-structural damage, not repaired — cannot be re-registered */
    CAT_D = 'CAT_D',
}

/** European emission standards relevant to UK ULEZ / CAZ zones */
export enum EuroStandard {
    EURO_4 = 'EURO_4',
    EURO_5 = 'EURO_5',
    EURO_6 = 'EURO_6',
    EURO_6D = 'EURO_6D',
}

// ─── DTO ─────────────────────────────────────────────────────────────────────

export class CreateListingDto {
    @ApiProperty({ description: 'Title of the listing', example: 'Audi Q7 2015 S-Line Quattro', minLength: 5, maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @Length(5, 200)
    title: string;

    @ApiProperty({ description: 'Asking price of the vehicle in GBP (set from priceMin when using offers)', example: 25000.99 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    price: number;

    @ApiProperty({ description: 'Minimum acceptable offer price in GBP (enables offer system)', example: 20000, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    priceMin?: number;

    @ApiProperty({ description: 'Maximum acceptable offer price in GBP', example: 27000, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    priceMax?: number;

    @ApiProperty({ description: 'Mileage in miles', example: 45000 })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    mileage: number;

    @ApiProperty({ description: 'Year of manufacture', example: 2015 })
    @Type(() => Number)
    @IsInt()
    @Min(1900)
    @Max(new Date().getFullYear() + 1)
    year: number;

    @ApiProperty({ description: 'UK Vehicle Registration Mark (VRM)', example: 'AB12 CDE' })
    @IsString()
    @IsNotEmpty()
    @Length(2, 15)
    vrm: string;

    @ApiProperty({ description: 'Vehicle Identification Number (VIN, 17 characters)', example: 'WAUZZZ4G4EN006369', required: false })
    @IsString()
    @IsOptional()
    @Matches(/^[A-HJ-NPR-Z0-9]{17}$/i, { message: 'VIN must be a valid 17-character alphanumeric code' })
    vin?: string;

    @ApiProperty({ description: 'Make of the vehicle', example: 'Audi', required: false })
    @IsString()
    @IsOptional()
    make?: string;

    @ApiProperty({ description: 'Model of the vehicle', example: 'Q7', required: false })
    @IsString()
    @IsOptional()
    model?: string;

    @ApiProperty({ description: 'Detailed description of the vehicle', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        description: 'Array of image URLs from Supabase Storage',
        example: ['https://your-project.supabase.co/storage/v1/object/public/listings/abc123.jpg'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
    images: string[];

    @ApiProperty({ description: 'Type of listing', enum: ListingType, example: ListingType.CLASSIFIED })
    @IsEnum(ListingType)
    listingType: ListingType;

    @ApiProperty({ description: 'Status of the listing', enum: ListingStatus, example: ListingStatus.DRAFT, required: false, default: ListingStatus.DRAFT })
    @IsEnum(ListingStatus)
    @IsOptional()
    status?: ListingStatus;

    @ApiProperty({ description: 'Fuel type', enum: FuelType, example: FuelType.DIESEL, required: false })
    @IsEnum(FuelType)
    @IsOptional()
    fuelType?: FuelType;

    @ApiProperty({ description: 'Transmission type', enum: Transmission, example: Transmission.AUTOMATIC, required: false })
    @IsEnum(Transmission)
    @IsOptional()
    transmission?: Transmission;

    @ApiProperty({ description: 'Body type', enum: BodyType, example: BodyType.SUV, required: false })
    @IsEnum(BodyType)
    @IsOptional()
    bodyType?: BodyType;

    @ApiProperty({ description: 'Vehicle condition', enum: VehicleCondition, example: VehicleCondition.GOOD, required: false })
    @IsEnum(VehicleCondition)
    @IsOptional()
    condition?: VehicleCondition;

    @ApiProperty({ description: 'Whether the vehicle is ULEZ / CAZ compliant', example: true, required: false })
    @IsBoolean()
    @IsOptional()
    ulezCompliant?: boolean;

    @ApiProperty({ description: 'European emission standard', enum: EuroStandard, example: EuroStandard.EURO_6, required: false })
    @IsEnum(EuroStandard)
    @IsOptional()
    euroStandard?: EuroStandard;

    @ApiProperty({ description: 'CO2 emissions in g/km (from DVLA)', example: 142, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(9999)
    @IsOptional()
    co2Emissions?: number;

    @ApiProperty({ description: 'Exterior color', example: 'Misano Blue', required: false })
    @IsString()
    @IsOptional()
    color?: string;

    @ApiProperty({ description: 'Number of doors', example: 5, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(8)
    @IsOptional()
    doors?: number;

    @ApiProperty({ description: 'Number of seats', example: 7, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    @IsOptional()
    seats?: number;

    @ApiProperty({ description: 'Engine size in cc', example: 2993, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    engineSize?: number;

    @ApiProperty({ description: 'Engine power in BHP', example: 258, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    bhp?: number;

    @ApiProperty({ description: 'List of vehicle features', example: ['Sunroof', 'Heated Seats'], required: false })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    features?: string[];

    @ApiProperty({ description: 'Location where the vehicle is based', example: 'London', required: false })
    @IsString()
    @IsOptional()
    location?: string;
}
