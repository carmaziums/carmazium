import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';
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

    @ApiProperty({ description: 'Annual quoted premium (required when status is QUOTED)', required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    quotedPrice?: number;

    @ApiProperty({ description: 'Coverage type offered', required: false })
    @IsOptional()
    @IsString()
    @Length(2, 80)
    coverageType?: string;
}
