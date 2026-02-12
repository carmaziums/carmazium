import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ListingStatus } from '@prisma/client';

export class UpdateStatusDto {
    @ApiProperty({
        enum: ListingStatus,
        description: 'New status for the listing',
        example: ListingStatus.ACTIVE,
    })
    @IsNotEmpty()
    @IsEnum(ListingStatus)
    status: ListingStatus;
}
