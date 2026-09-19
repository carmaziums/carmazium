import {
    IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsArray, IsUUID,
    IsDateString, IsNotEmpty, Min, Max, MaxLength, ValidateNested, ArrayMinSize, ArrayMaxSize, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType, CapabilityStatus } from '@prisma/client';

/** Service areas with a job flow. FINANCE and WARRANTY are enquiry-based (phase 3). */
export const JOB_SERVICE_TYPES = [ServiceType.DELIVERY, ServiceType.INSPECTION] as const;

export class JobVehicleDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
    registration?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
    make?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
    model?: string;

    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) @Max(2100)
    year?: number;

    @ApiPropertyOptional({ description: '"non-runner", "no keys", "low clearance"' })
    @IsOptional() @IsString() @MaxLength(300)
    notes?: string;

    @ApiPropertyOptional({ description: 'Set when the vehicle is a CarMazium listing' })
    @IsOptional() @IsUUID()
    listingId?: string;
}

export class CreateJobDto {
    @ApiProperty({ enum: JOB_SERVICE_TYPES })
    @IsEnum(ServiceType)
    serviceType: ServiceType;

    @ApiPropertyOptional({ description: 'Broken-down / non-runner. Delivery only.' })
    @IsOptional() @IsBoolean()
    isRecovery?: boolean;

    @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120)
    title: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
    description?: string;

    // Delivery
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
    pickupPostcode?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
    pickupAddress?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
    deliveryPostcode?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
    deliveryAddress?: string;

    // Inspection
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
    servicePostcode?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
    serviceAddress?: string;

    @ApiPropertyOptional({ description: 'ISO date. Omit for "as soon as possible".' })
    @IsOptional() @IsDateString()
    requestedFor?: string;

    @ApiProperty({ type: [JobVehicleDto] })
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12)
    @ValidateNested({ each: true }) @Type(() => JobVehicleDto)
    vehicles: JobVehicleDto[];
}

export class JobFromPurchaseDto {
    @ApiPropertyOptional() @IsOptional() @IsUUID()
    offerId?: string;

    @ApiPropertyOptional() @IsOptional() @IsUUID()
    auctionId?: string;

    @ApiProperty({ description: 'Where the customer wants the car delivered' })
    @IsString() @IsNotEmpty() @MaxLength(10)
    deliveryPostcode: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
    deliveryAddress?: string;

    @ApiPropertyOptional() @IsOptional() @IsDateString()
    requestedFor?: string;
}

export class CancelJobDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
    reason?: string;
}

export class UpsertQuoteDto {
    @ApiProperty({ description: 'Whole job, in pence, inc. VAT if the contractor charges it' })
    @IsInt() @Min(100) @Max(50_000_00)
    amountPence: number;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
    message?: string;

    @ApiPropertyOptional({ description: 'ISO date after which the quote lapses' })
    @IsOptional() @IsDateString()
    validUntil?: string;
}

export class ApplyCapabilityDto {
    @ApiProperty({ enum: ServiceType })
    @IsEnum(ServiceType)
    serviceType: ServiceType;

    @ApiPropertyOptional({ description: 'Trading name shown on quotes' })
    @IsOptional() @IsString() @MaxLength(120)
    businessName?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
    phone?: string;

    @ApiPropertyOptional({ description: 'e.g. "Kent and East Sussex"' })
    @IsOptional() @IsString() @MaxLength(200)
    serviceArea?: string;
}

export class UpdateLeadMatchingDto {
    @ApiProperty()
    @IsBoolean()
    leadNationwide: boolean;

    @ApiPropertyOptional({ description: 'UK postcode areas, e.g. B, CV, M, SW. Ignored when nationwide is true.' })
    @IsOptional() @IsArray() @ArrayMaxSize(32)
    @IsString({ each: true }) @MaxLength(3, { each: true }) @Matches(/^[A-Za-z]{1,3}$/, { each: true })
    leadPostcodeAreas?: string[];

    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(500_000_00)
    leadMinVehicleValuePence?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(500_000_00)
    leadMaxVehicleValuePence?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) @Max(2100)
    leadMinVehicleYear?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(2_000_000)
    leadMaxVehicleMileage?: number;

    // Finance-only matching
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10_000_000_00)
    leadMinAnnualIncomePence?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(120)
    leadFinanceTermMinMonths?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(120)
    leadFinanceTermMaxMonths?: number;

    // Warranty-only matching
    @ApiPropertyOptional({ description: 'Requested cover levels this provider serves.' })
    @IsOptional() @IsArray() @ArrayMaxSize(8)
    @IsString({ each: true }) @MaxLength(80, { each: true })
    leadWarrantyLevels?: string[];
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(84)
    leadWarrantyMinMonths?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(84)
    leadWarrantyMaxMonths?: number;
}

export class ReviewCapabilityDto {
    @ApiProperty({ enum: [CapabilityStatus.APPROVED, CapabilityStatus.REJECTED, CapabilityStatus.SUSPENDED] })
    @IsEnum(CapabilityStatus)
    status: CapabilityStatus;

    @ApiPropertyOptional({ description: 'Shown to the contractor on rejection/suspension' })
    @IsOptional() @IsString() @MaxLength(1000)
    reviewNote?: string;
}

export class ResolveDisputeDto {
    @ApiProperty({ enum: ['RELEASE', 'REFUND'] })
    @IsEnum(['RELEASE', 'REFUND'])
    outcome: 'RELEASE' | 'REFUND';

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
    note?: string;
}
