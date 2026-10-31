import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const INSPECTION_NOTE_KINDS = ['NEW_DAMAGE', 'DIFFERS_FROM_ADVERT', 'GENERAL'] as const;

export class CreateInspectionNoteDto {
    @ApiProperty({ enum: INSPECTION_NOTE_KINDS, description: 'What the dealer found during inspection' })
    @IsIn(INSPECTION_NOTE_KINDS as unknown as string[])
    kind!: typeof INSPECTION_NOTE_KINDS[number];

    @ApiPropertyOptional({ description: 'Panel or area, e.g. "Front bumper"' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    part?: string;

    @ApiProperty({ description: 'What was found, in the dealer\'s words' })
    @IsString()
    @MinLength(3)
    @MaxLength(2000)
    description!: string;
}
