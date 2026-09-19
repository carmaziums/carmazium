import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
} from 'class-validator';

export class AlsoAuctionDto {
    @ApiProperty({ description: 'Auction start time in ISO-8601 format' })
    @IsString()
    @IsNotEmpty()
    startTime: string;

    @ApiProperty({ description: 'Seller reserve price in GBP' })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    reservePrice: number;

    @ApiProperty({
        description: 'Legacy client starting bid. The server recalculates the actual opening bid at 70% of the source price.',
        required: false,
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    startingBid?: number;

    @ApiProperty({ description: 'Minimum bid increment in GBP', required: false, default: 100 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    minIncrement?: number;

    @ApiProperty({ description: 'Optional Buy It Now price in GBP', required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    buyItNowPrice?: number;
}
