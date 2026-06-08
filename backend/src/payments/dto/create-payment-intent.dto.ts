import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsString, Length, IsIn } from 'class-validator';
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

    @ApiPropertyOptional({ description: 'Payment type', default: 'FULL_PAYMENT' })
    @IsOptional()
    @IsString()
    @IsIn(['DEPOSIT', 'FULL_PAYMENT', 'COMMISSION'])
    type?: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION';

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

    @ApiPropertyOptional({ description: 'Payment type', default: 'FULL_PAYMENT' })
    @IsOptional()
    @IsString()
    @IsIn(['DEPOSIT', 'FULL_PAYMENT', 'COMMISSION'])
    type?: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION';

    @ApiPropertyOptional({ description: 'ISO 4217 currency code', default: 'gbp' })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string;
}
