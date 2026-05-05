import { IsString, IsOptional, IsEnum, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
    @ApiProperty({ description: 'Name of the prospective buyer' })
    @IsString()
    buyerName: string;

    @ApiPropertyOptional({ description: 'Buyer email address' })
    @IsOptional()
    @IsEmail()
    buyerEmail?: string;

    @ApiPropertyOptional({ description: 'Buyer phone number' })
    @IsOptional()
    @IsString()
    buyerPhone?: string;

    @ApiPropertyOptional({ description: 'Listing ID the lead is interested in' })
    @IsOptional()
    @IsString()
    listingId?: string;

    @ApiPropertyOptional({ description: 'Sales agent user ID to assign the lead to' })
    @IsOptional()
    @IsString()
    assignedToId?: string;

    @ApiPropertyOptional({ description: 'Lead source: listing_enquiry, chat, offer, walk_in, phone' })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({ description: 'Notes about the lead' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'WON', 'LOST'] })
    @IsOptional()
    @IsString()
    status?: string;
}
