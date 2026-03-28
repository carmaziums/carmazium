import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';


export class UpdateStatusDto {
    @ApiProperty({
        enum: ['DRAFT', 'ACTIVE', 'SOLD', 'WITHDRAWN'],
        description: 'New status for the listing',
        example: 'ACTIVE',
    })
    @IsNotEmpty()
    @IsEnum(['DRAFT', 'ACTIVE', 'SOLD', 'WITHDRAWN'])
    status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'WITHDRAWN';
}
