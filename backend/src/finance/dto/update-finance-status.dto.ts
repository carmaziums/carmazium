import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { FinanceApplicationStatus } from '@prisma/client';
import { Type } from 'class-transformer';

const FinanceApplicationStatusEnum = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
};

export class UpdateFinanceStatusDto {
    @ApiProperty({
        description: 'New status',
        enum: Object.values(FinanceApplicationStatusEnum),
        example: FinanceApplicationStatusEnum.APPROVED,
    })
    @IsNotEmpty()
    @IsEnum(FinanceApplicationStatusEnum)
    status: FinanceApplicationStatus;

    @ApiProperty({ description: 'Monthly payment amount (if approved)', required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    monthlyPayment?: number;
}
