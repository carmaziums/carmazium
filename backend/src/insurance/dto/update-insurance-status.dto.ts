import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { InsuranceQuoteStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateInsuranceStatusDto {
    @ApiProperty({
        description: 'New status',
        enum: InsuranceQuoteStatus,
        example: InsuranceQuoteStatus.QUOTED,
    })
    @IsNotEmpty()
    @IsEnum(InsuranceQuoteStatus)
    status: InsuranceQuoteStatus;

    @ApiProperty({ description: 'Annual price (if quoted)', required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    annualPrice?: number;
}
