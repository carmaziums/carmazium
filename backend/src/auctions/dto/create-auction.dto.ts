import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

export class CreateAuctionDto {
    @ApiProperty({ description: 'UUID of the listing to auction' })
    @IsUUID()
    listingId: string;

    @ApiProperty({ description: 'Auction start time (ISO string). End time is always startTime + 5 hours.', example: '2026-06-01T10:00:00.000Z' })
    @IsDateString()
    startTime: string;

    @ApiProperty({ description: 'Reserve price — minimum amount to declare a winner', example: 15000 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    reservePrice: number;

    @ApiProperty({ description: 'Minimum first bid amount', example: 5000 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    startingBid: number;

    @ApiPropertyOptional({ description: 'Minimum bid increment per step', example: 100, default: 100 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(1)
    minIncrement: number = 100;
}
