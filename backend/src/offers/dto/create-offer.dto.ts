import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsUUID,
    IsNumber,
    IsPositive,
    IsOptional,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto {
    @ApiProperty({ description: 'ID of the listing to make an offer on', example: '123e4567-e89b-12d3-a456-426614174000' })
    @IsUUID()
    listingId: string;

    @ApiProperty({ description: 'Offer amount in GBP (midpoint, kept for backward-compat)', example: 12000.00 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    amount: number;

    @ApiProperty({ description: 'Minimum offer amount in GBP (buyer lower bound)', example: 11000.00, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    amountMin?: number;

    @ApiProperty({ description: 'Maximum offer amount in GBP (buyer upper bound)', example: 13000.00, required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    amountMax?: number;

    @ApiProperty({ description: 'Optional message to the seller', example: 'I can collect this weekend.', required: false })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    message?: string;
}
