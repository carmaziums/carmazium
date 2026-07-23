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
    MaxLength,
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
    LPG = 'LPG',
    HYDROGEN_CELL = 'HYDROGEN_CELL',
    BI_FUEL = 'BI_FUEL',
    NATURAL_GAS = 'NATURAL_GAS',
    PETROL_HYBRID = 'PETROL_HYBRID',
    DIESEL_HYBRID = 'DIESEL_HYBRID',
    PETROL_PLUGIN_HYBRID = 'PETROL_PLUGIN_HYBRID',
    DIESEL_PLUGIN_HYBRID = 'DIESEL_PLUGIN_HYBRID',
    UNLISTED = 'UNLISTED',
}

export enum Transmission {
    MANUAL = 'MANUAL',
    AUTOMATIC = 'AUTOMATIC',
    SEMI_AUTOMATIC = 'SEMI_AUTOMATIC',
    CVT = 'CVT',
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

export enum VehicleType {
    CAR = 'CAR',
    HGV = 'HGV',
    MOTORCYCLE = 'MOTORCYCLE',
}

/** Insurance write-off category — mirrors the Prisma WriteOffCategory enum */
export enum WriteOffCategory {
    NONE  = 'NONE',
    CAT_S = 'CAT_S',
    CAT_N = 'CAT_N',
    /** Structural total loss — auction only, cannot be re-registered */
    CAT_A = 'CAT_A',
    /** Body salvage — auction only, cannot be re-registered */
    CAT_B = 'CAT_B',
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
    @IsOptional()
    images: string[];

    @ApiProperty({ description: 'Array of video URLs (YouTube, Instagram, Facebook, X)', type: [String], required: false })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    videoUrls?: string[];

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

    // ─── DVLA extended fields (auto-filled from VES API) ────────────────────
    @ApiProperty({ description: 'MOT status from DVLA', example: 'Valid', required: false })
    @IsString()
    @IsOptional()
    motStatus?: string;

    @ApiProperty({ description: 'Tax status from DVLA', example: 'Taxed', required: false })
    @IsString()
    @IsOptional()
    taxStatus?: string;

    @ApiProperty({ description: 'MOT expiry date from DVLA', example: '2025-09-15', required: false })
    @IsString()
    @IsOptional()
    motExpiryDate?: string;

    @ApiProperty({ description: 'Tax due date from DVLA', example: '2025-03-01', required: false })
    @IsString()
    @IsOptional()
    taxDueDate?: string;

    @ApiProperty({ description: 'Whether the vehicle is marked for export', example: false, required: false })
    @IsBoolean()
    @IsOptional()
    markedForExport?: boolean;

    @ApiProperty({ description: 'Month of first registration from DVLA', example: '2015-03', required: false })
    @IsString()
    @IsOptional()
    monthOfFirstRegistration?: string;

    @ApiProperty({ description: 'Wheelplan from DVLA', example: '2 AXLE RIGID BODY', required: false })
    @IsString()
    @IsOptional()
    wheelplan?: string;

    @ApiProperty({ description: 'Type approval from DVLA', example: 'M1', required: false })
    @IsString()
    @IsOptional()
    typeApproval?: string;

    @ApiProperty({ description: 'Badge tier: FREE, STANDARD (£10), or PREMIUM (£25 + boost)', example: 'FREE', required: false, default: 'FREE' })
    @IsString()
    @IsOptional()
    badgeTier?: string;

    @ApiProperty({ description: 'Vehicle type', enum: VehicleType, example: VehicleType.CAR, required: false, default: VehicleType.CAR })
    @IsEnum(VehicleType)
    @IsOptional()
    vehicleType?: VehicleType;

    @ApiProperty({ description: 'Whether this is an imported vehicle', example: false, required: false, default: false })
    @IsBoolean()
    @IsOptional()
    isImported?: boolean;

    @ApiProperty({ description: 'Has the vehicle ever been reported stolen or recovered?', example: false, required: false })
    @IsBoolean()
    @IsOptional()
    stolenRecovered?: boolean;

    @ApiProperty({ description: 'Is there currently outstanding finance on the vehicle?', example: false, required: false })
    @IsBoolean()
    @IsOptional()
    hasOutstandingFinance?: boolean;

    @ApiProperty({ description: 'Is the seller the legal registered keeper of the vehicle?', example: true, required: false })
    @IsBoolean()
    @IsOptional()
    isLegalRegisteredKeeper?: boolean;

    @ApiProperty({
        description: 'Insurance write-off category. CAT_A and CAT_B are only permitted for AUCTION listings.',
        enum: WriteOffCategory,
        example: WriteOffCategory.NONE,
        required: false,
    })
    @IsEnum(WriteOffCategory)
    @IsOptional()
    writeOffCategory?: WriteOffCategory;

    // ─── Extended vehicle details ────────────────────────────────────────────

    @ApiProperty({ description: 'Model variant/trim level', example: 'M Sport', required: false })
    @IsString()
    @IsOptional()
    variant?: string;

    @ApiProperty({ description: 'Drive type: FWD, RWD, AWD, 4WD', example: 'AWD', required: false })
    @IsString()
    @IsOptional()
    driveType?: string;

    @ApiProperty({ description: 'Number of keys included with the vehicle', example: 2, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10)
    @IsOptional()
    numberOfKeys?: number;

    @ApiProperty({ description: 'Service history type', example: 'Full Main Dealer', required: false })
    @IsString()
    @IsOptional()
    serviceHistory?: string;

    @ApiProperty({ description: 'Number of previous keepers', example: '2', required: false })
    @IsString()
    @IsOptional()
    owners?: string;

    @ApiProperty({ description: 'Whether this is a departed/estate sale', required: false })
    @IsOptional()
    @IsBoolean()
    isDepartedSale?: boolean;

    @ApiProperty({ description: 'Relationship of the seller to the departed owner (e.g. "Son", "Executor")', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    departedRelationship?: string;

    @ApiProperty({ description: 'Relationship of the seller to the legal registered keeper, when the seller is not the keeper (e.g. "Family member", "Employer")', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    notOwnerRelationship?: string;

    @ApiProperty({ description: 'Torque in Nm', example: 400, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    torqueNm?: number;

    @ApiProperty({ description: 'Top speed in mph', example: 155, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    topSpeedMph?: number;

    @ApiProperty({ description: '0-60 mph time in seconds', example: 4.5, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @IsOptional()
    zeroTo60Mph?: number;

    @ApiProperty({ description: 'Combined fuel economy in MPG', example: 38.2, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0)
    @IsOptional()
    combinedMpg?: number;

    @ApiProperty({ description: 'Extra urban fuel economy in MPG', example: 45.6, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0)
    @IsOptional()
    extraUrbanMpg?: number;

    @ApiProperty({ description: 'Exterior grade (1 = best condition, 5 = heaviest damage), Motorway-style', example: 2, required: false, minimum: 1, maximum: 5 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    @IsOptional()
    exteriorGrade?: number;

    @ApiProperty({ description: 'Attention label shown as a ribbon on the vehicle card', example: 'Below Market Value', required: false })
    @IsString()
    @IsOptional()
    @MaxLength(40)
    bannerLabel?: string;

    @ApiProperty({ description: 'Whether seller offers delivery for this listing', required: false })
    @IsOptional()
    @IsBoolean()
    deliveryAvailable?: boolean;

    @ApiProperty({ description: 'Delivery price per mile in GBP', example: 0.5, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @IsOptional()
    deliveryPricePerMile?: number;

    @ApiProperty({ description: 'Maximum delivery radius in miles (null = UK-wide)', required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    deliveryMaxMiles?: number;
}
