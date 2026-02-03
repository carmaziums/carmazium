import { IsNotEmpty, IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBidDto {
    @ApiProperty({ description: 'ID of the listing to bid on' })
    @IsNotEmpty()
    @IsUUID()
    listingId: string;

    @ApiProperty({ description: 'Bid amount in GBP', example: 50000 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    amount: number;
}
