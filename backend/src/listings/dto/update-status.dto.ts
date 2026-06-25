import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateStatusDto {
    @ApiProperty({
        enum: ['DRAFT', 'ACTIVE', 'SOLD', 'WITHDRAWN'],
        description: 'New status for the listing',
        example: 'ACTIVE',
    })
    @IsNotEmpty()
    @IsEnum(['DRAFT', 'ACTIVE', 'SOLD', 'WITHDRAWN'])
    status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'WITHDRAWN';

    @ApiProperty({
        description: 'Buyer UK postcode (optional, recorded for analytics when marking as SOLD)',
        example: 'SW1A 1AA',
        required: false,
    })
    @IsOptional()
    @IsString()
    @Matches(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, { message: 'Invalid UK postcode format' })
    buyerPostcode?: string;
}
