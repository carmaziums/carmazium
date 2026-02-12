import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreateAuctionDto {
    @ApiProperty({ description: 'UUID of the listing to auction' })
    @IsUUID()
    listingId: string;

    @ApiProperty({ description: 'Start time of the auction' })
    @Type(() => Date)
    @IsDate()
    startTime: Date;

    @ApiProperty({ description: 'End time of the auction' })
    @Type(() => Date)
    @IsDate()
    // Validation handled in service
    endTime: Date;

    @ApiProperty({ description: 'Reserve price (minimum sale price)', example: 15000 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    reservePrice: number;

    @ApiProperty({ description: 'Starting bid amount', example: 1000 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    startingBid: number;

    @ApiProperty({ description: 'Minimum bid increment', example: 100 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    minIncrement: number;
}
