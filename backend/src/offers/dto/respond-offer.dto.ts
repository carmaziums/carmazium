import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum OfferResponseStatus {
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
}

export class RespondOfferDto {
    @ApiProperty({
        description: 'The seller\'s response to the offer',
        enum: OfferResponseStatus,
        example: OfferResponseStatus.ACCEPTED,
    })
    @IsEnum(OfferResponseStatus)
    status: OfferResponseStatus;
}
