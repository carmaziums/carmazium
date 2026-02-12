import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { ServiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateServiceStatusDto {
    @ApiProperty({
        description: 'New status for the service request',
        enum: ServiceStatus,
        example: ServiceStatus.ACCEPTED,
    })
    @IsEnum(ServiceStatus)
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
