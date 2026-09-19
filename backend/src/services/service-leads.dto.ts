import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsIn,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ServiceType } from '@prisma/client';

export class ServiceLeadListQueryDto {
    @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
    limit?: number;

    @ApiPropertyOptional({ description: 'Opaque cursor returned by the previous page' })
    @IsOptional() @IsString() @MaxLength(500)
    cursor?: string;
}

export class ServiceLeadInboxQueryDto extends ServiceLeadListQueryDto {
    @ApiPropertyOptional({ enum: [ServiceType.FINANCE, ServiceType.WARRANTY] })
    @IsOptional() @IsIn([ServiceType.FINANCE, ServiceType.WARRANTY])
    serviceType?: ServiceType;
}

export class CreateServiceLeadDto {
    @ApiProperty({ enum: [ServiceType.FINANCE, ServiceType.WARRANTY] })
    @IsIn([ServiceType.FINANCE, ServiceType.WARRANTY])
    serviceType: ServiceType;

    @ApiPropertyOptional({ description: 'Optional CarMazium listing connected to the enquiry' })
    @IsOptional() @IsUUID()
    listingId?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
    vehicleRegistration?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
    vehicleMake?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
    vehicleModel?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) @Max(2100)
    vehicleYear?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(2_000_000)
    vehicleMileage?: number;
    @ApiPropertyOptional({ description: 'Estimated vehicle value in pence' })
    @IsOptional() @IsInt() @Min(0) @Max(500_000_00)
    vehicleValuePence?: number;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
    phone?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
    postcode?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
    summary?: string;

    // Finance
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(500_000_00)
    depositPence?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(120)
    termMonths?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100_000_00)
    monthlyBudgetPence?: number;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
    employmentStatus?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10_000_000_00)
    annualIncomePence?: number;

    // Warranty
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(84)
    warrantyMonths?: number;
    @ApiPropertyOptional({ description: 'e.g. Essential, Comprehensive, Premium' })
    @IsOptional() @IsString() @MaxLength(80)
    warrantyLevel?: string;

    @ApiProperty({ description: 'Explicit consent for matched approved providers to receive contact details' })
    @IsBoolean()
    consentToProviderContact: boolean;
}

export class RespondToServiceLeadDto {
    @ApiProperty() @IsString() @MaxLength(120)
    headline: string;

    @ApiProperty() @IsString() @MaxLength(2000)
    message: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
    productName?: string;

    @ApiPropertyOptional({ description: 'Indicative quote/cost in pence; not a guaranteed finance offer' })
    @IsOptional() @IsInt() @Min(0) @Max(500_000_00)
    indicativePricePence?: number;

    @ApiPropertyOptional({ description: 'Provider-supplied representative APR percentage for finance responses' })
    @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(100)
    representativeApr?: number;

    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(120)
    termMonths?: number;
}
