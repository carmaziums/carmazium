import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class AdminCorrectAuctionPriceDto {
    @ApiProperty({
        description: 'Corrected auction reserve price in GBP',
        example: 8500,
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    reservePrice: number;

    @ApiPropertyOptional({
        description: 'Optional internal/customer-facing reason for the correction',
        example: 'Seller entered an extra zero in the reserve price.',
        maxLength: 300,
    })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    reason?: string;
}
