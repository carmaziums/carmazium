import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { ServiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';

const ServiceStatusEnum = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
};

export class UpdateServiceStatusDto {
    @ApiProperty({
        description: 'New status for the service request',
        enum: Object.values(ServiceStatusEnum),
        example: ServiceStatusEnum.ACCEPTED,
    })
    @IsEnum(ServiceStatusEnum)
    @IsNotEmpty()
    status: ServiceStatus;

    @ApiProperty({
        description: 'Quoted or agreed price (required if accepting)',
        required: false,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    price?: number;
}

