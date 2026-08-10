import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsEnum,
    IsNumber,
    IsPositive,
    IsInt,
    IsBoolean,
    IsArray,
    IsUrl,
    IsDateString,
    Min,
    Max,
    IsOptional,
    Length,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
    FuelType,
    Transmission,
    BodyType,
    VehicleCondition,
    VehicleType,
    WriteOffCategory,
    EuroStandard,
    ListingType,
} from '../../listings/dto/create-listing.dto';

/**
 * Fields an admin can correct while a listing is awaiting review (PENDING_REVIEW
 * or REJECTED) — e.g. fixing a seller's typo before approving instead of
 * bouncing it back and forth. Mirrors every field the seller could have set
 * in the listing wizard (CreateListingDto), plus the auction schedule fields
 * (reservePrice/startingBid/minIncrement/buyItNowPrice/startTime) for AUCTION
 * listings, which live on the related Auction row rather than Listing itself.
 */
export class AdminUpdateListingDto {
    // ─── Core ────────────────────────────────────────────────────────────────
    @ApiProperty({ required: false, minLength: 5, maxLength: 200 })
    @IsString()
    @IsOptional()
    @Length(5, 200)
    title?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    price?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    priceMin?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    priceMax?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    // ─── Vehicle identity ───────────────────────────────────────────────────
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    make?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    model?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    variant?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1900)
    @Max(new Date().getFullYear() + 1)
    @IsOptional()
    year?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    mileage?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    @Length(2, 15)
    vrm?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    vin?: string;

    // ─── Mechanical / body ──────────────────────────────────────────────────
    @ApiProperty({ enum: FuelType, required: false })
    @IsEnum(FuelType)
    @IsOptional()
    fuelType?: FuelType;

    @ApiProperty({ enum: Transmission, required: false })
    @IsEnum(Transmission)
    @IsOptional()
    transmission?: Transmission;

    @ApiProperty({ enum: BodyType, required: false })
    @IsEnum(BodyType)
    @IsOptional()
    bodyType?: BodyType;

    @ApiProperty({ enum: VehicleCondition, required: false })
    @IsEnum(VehicleCondition)
    @IsOptional()
    condition?: VehicleCondition;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    color?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(8)
    @IsOptional()
    doors?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    @IsOptional()
    seats?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    driveType?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    engineSize?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    bhp?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    torqueNm?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    topSpeedMph?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @IsOptional()
    zeroTo60Mph?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0)
    @IsOptional()
    combinedMpg?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0)
    @IsOptional()
    extraUrbanMpg?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    ulezCompliant?: boolean;

    @ApiProperty({ enum: EuroStandard, required: false })
    @IsEnum(EuroStandard)
    @IsOptional()
    euroStandard?: EuroStandard;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(9999)
    @IsOptional()
    co2Emissions?: number;

    // ─── History / ownership ────────────────────────────────────────────────
    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10)
    @IsOptional()
    numberOfKeys?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    serviceHistory?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    owners?: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    stolenRecovered?: boolean;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    hasOutstandingFinance?: boolean;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isLegalRegisteredKeeper?: boolean;

    @ApiProperty({ enum: WriteOffCategory, required: false })
    @IsEnum(WriteOffCategory)
    @IsOptional()
    writeOffCategory?: WriteOffCategory;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isDepartedSale?: boolean;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    @MaxLength(200)
    departedRelationship?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    @MaxLength(200)
    notOwnerRelationship?: string;

    // ─── DVLA-derived (admin correction) ────────────────────────────────────
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    motStatus?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    taxStatus?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    motExpiryDate?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    taxDueDate?: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    markedForExport?: boolean;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    monthOfFirstRegistration?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    wheelplan?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    typeApproval?: string;

    // ─── Listing meta ────────────────────────────────────────────────────────
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiProperty({ enum: VehicleType, required: false })
    @IsEnum(VehicleType)
    @IsOptional()
    vehicleType?: VehicleType;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isImported?: boolean;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    @MaxLength(40)
    bannerLabel?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    features?: string[];

    // ─── Delivery ────────────────────────────────────────────────────────────
    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    deliveryAvailable?: boolean;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @IsOptional()
    deliveryPricePerMile?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    deliveryMaxMiles?: number;

    // ─── Media ───────────────────────────────────────────────────────────────
    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
    @IsOptional()
    images?: string[];

    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    videoUrls?: string[];

    // ─── Listing type & badge tier ──────────────────────────────────────────
    @ApiProperty({ enum: ListingType, required: false })
    @IsEnum(ListingType)
    @IsOptional()
    listingType?: ListingType;

    @ApiProperty({ description: 'Badge tier: FREE, STANDARD, or PREMIUM', required: false })
    @IsString()
    @IsOptional()
    badgeTier?: string;

    // ─── Auction schedule (AUCTION listings only — lives on the Auction row) ──
    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    reservePrice?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    startingBid?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    minIncrement?: number;

    @ApiProperty({ required: false, description: 'Set to null to clear an existing Buy It Now price' })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    buyItNowPrice?: number;

    @ApiProperty({ required: false, description: 'ISO datetime — endTime is always recalculated as startTime + 24h' })
    @IsDateString()
    @IsOptional()
    startTime?: string;
}
