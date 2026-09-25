import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsString, Length, IsIn, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCheckoutSessionDto {
    @ApiProperty({ description: 'Listing ID to purchase' })
    @IsString()
    listingId: string;

    @ApiProperty({ description: 'Amount in GBP (e.g. 500.00 for a deposit, or full price)', minimum: 1 })
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    amount: number;

    @ApiProperty({ description: 'Platform payment type', enum: ['COMMISSION'] })
    @IsString()
    @IsIn(['COMMISSION'])
    type: 'COMMISSION';

    @ApiPropertyOptional({ description: 'ISO 4217 currency code', default: 'gbp' })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string;
}

// Keep backward-compatible export name
export { CreateCheckoutSessionDto as CreatePaymentIntentDto };

/** DTO for the Payment Sheet flow (native SDK) */
export class CreatePaymentSheetDto {
    @ApiProperty({ description: 'Listing ID' })
    @IsString()
    listingId: string;

    @ApiProperty({ description: 'Amount in GBP', minimum: 1 })
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    amount: number;

    @ApiProperty({ description: 'Platform payment type', enum: ['COMMISSION', 'LISTING_FEE', 'HPI_REPORT', 'HPI_REPORT_EMAIL'] })
    @IsString()
    @IsIn(['COMMISSION', 'LISTING_FEE', 'HPI_REPORT', 'HPI_REPORT_EMAIL'])
    type: 'COMMISSION' | 'LISTING_FEE' | 'HPI_REPORT' | 'HPI_REPORT_EMAIL';

    @ApiPropertyOptional({ description: 'ISO 4217 currency code', default: 'gbp' })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string;

    @ApiPropertyOptional({
        description: 'Listing badge tier — required when type is LISTING_FEE so the webhook knows which tier to activate the listing at',
    })
    @ValidateIf((o) => o.type === 'LISTING_FEE')
    @IsIn(['BASIC', 'STANDARD', 'PREMIUM'])
    badgeTier?: 'BASIC' | 'STANDARD' | 'PREMIUM';

    @ApiPropertyOptional({
        description: 'Vehicle registration mark — required when type is HPI_REPORT so the webhook knows which VRM to run the check against',
    })
    @ValidateIf((o) => o.type === 'HPI_REPORT')
    @IsString()
    vrm?: string;
}
