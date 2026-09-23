import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TrackDealerCallDto {
    @ApiProperty({ description: 'Retail listing the buyer is calling about' })
    @IsString()
    listingId!: string;
}
