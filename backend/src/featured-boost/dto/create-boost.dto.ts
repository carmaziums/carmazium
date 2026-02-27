import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBoostDto {
    @ApiProperty({ description: 'ID of the listing to boost', example: 'uuid-here' })
    @IsString()
    @IsNotEmpty()
    listingId: string;
}
