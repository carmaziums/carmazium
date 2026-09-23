import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeadDto {
    @ApiPropertyOptional({ enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'WON', 'LOST'] })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Sales agent user ID to reassign the lead to' })
    @IsOptional()
    @IsString()
    assignedToId?: string;

    @ApiPropertyOptional({ description: 'Notes about the lead' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ description: 'Next follow-up reminder (ISO timestamp). Send null to clear it.', nullable: true })
    @IsOptional()
    @IsDateString()
    nextFollowUpAt?: string | null;
}
