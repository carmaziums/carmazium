import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum OfferResponseStatus {
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    COUNTERED = 'COUNTERED',
}

export class RespondOfferDto {
    @ApiProperty({
        description: 'The seller\'s response to the offer',
        enum: OfferResponseStatus,
        example: OfferResponseStatus.ACCEPTED,
    })
    @IsEnum(OfferResponseStatus)
    status: OfferResponseStatus;

    @ApiProperty({
        description: 'The counter offer amount if status is COUNTERED',
        required: false,
        example: 15000,
    })
    counterAmount?: number;
}
