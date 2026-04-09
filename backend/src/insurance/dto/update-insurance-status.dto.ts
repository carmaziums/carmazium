import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { InsuranceQuoteStatus } from '@prisma/client';
import { Type } from 'class-transformer';

const InsuranceQuoteStatusEnum = {
    PENDING: 'PENDING',
    QUOTED: 'QUOTED',
    ACCEPTED: 'ACCEPTED',
    EXPIRED: 'EXPIRED',
    REJECTED: 'REJECTED',
};

export class UpdateInsuranceStatusDto {
    @ApiProperty({
        description: 'New status',
        enum: Object.values(InsuranceQuoteStatusEnum),
        example: InsuranceQuoteStatusEnum.QUOTED,
    })
    @IsNotEmpty()
    @IsEnum(InsuranceQuoteStatusEnum)
    status: InsuranceQuoteStatus;

    @ApiProperty({ description: 'Annual price (if quoted)', required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    annualPrice?: number;
}
