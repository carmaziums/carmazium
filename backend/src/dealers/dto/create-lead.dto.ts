import { IsNotEmpty, IsString, IsOptional, IsEmail, IsDateString, IsEnum, IsIn, Matches } from 'class-validator';
import { LeadStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
    @ApiProperty({ description: 'Name of the prospective buyer' })
    @IsString()
    @Matches(/\S/, { message: 'Buyer name is required' })
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
    @IsNotEmpty()
    listingId?: string;

    @ApiPropertyOptional({ description: 'Authenticated buyer user ID, normally populated automatically by CarMazium' })
    @IsOptional()
    @IsString()
    buyerId?: string;

    @ApiPropertyOptional({ description: 'Sales agent user ID to assign the lead to' })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    assignedToId?: string;

    @ApiPropertyOptional({ description: 'Lead source: listing_enquiry, chat, offer, walk_in, phone' })
    @IsOptional()
    @IsIn(['listing_enquiry', 'chat', 'offer', 'walk_in', 'phone'])
    source?: string;

    @ApiPropertyOptional({ description: 'Notes about the lead' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ description: 'Optional next follow-up reminder (ISO timestamp)' })
    @IsOptional()
    @IsDateString()
    nextFollowUpAt?: string;

    @ApiPropertyOptional({ enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'WON', 'LOST'] })
    @IsOptional()
    @IsEnum(LeadStatus)
    status?: LeadStatus;
}
