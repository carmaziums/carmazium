import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { FinanceApplicationStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateFinanceStatusDto {
    @ApiProperty({
        description: 'New status',
        enum: FinanceApplicationStatus,
        example: FinanceApplicationStatus.APPROVED,
    })
    @IsNotEmpty()
    @IsEnum(FinanceApplicationStatus)
    status: FinanceApplicationStatus;

    @ApiProperty({ description: 'Monthly payment amount (if approved)', required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    monthlyPayment?: number;
}
