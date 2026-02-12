import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateServiceRequestDto {
    @ApiProperty({ description: 'UUID of the contractor', example: 'uuid-of-contractor' })
    @IsUUID()
    contractorId: string;

    @ApiProperty({ description: 'UUID of the listing (optional)', required: false })
    @IsOptional()
    @IsUUID()
    listingId?: string;

    @ApiProperty({ description: 'Type of service requested', example: 'Mechanic' })
    @IsNotEmpty()
    @IsString()
    serviceType: string;

    @ApiProperty({ description: 'Description of the issue', example: 'Engine makes noise' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Preferred scheduled date', required: false })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    scheduledDate?: Date;
}
