import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefuseAfterInspectionDto {
    @ApiPropertyOptional({ description: 'Optional buyer note explaining the refusal.' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}
