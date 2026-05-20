import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewKycFieldDto {
    @ApiProperty({ description: 'The field name being approved or rejected (e.g. companyHouseName)' })
    @IsString()
    field: string;

    @ApiProperty({ description: 'Review status for this specific field', enum: ['APPROVED', 'REJECTED'] })
    @IsEnum(['APPROVED', 'REJECTED'])
    status: 'APPROVED' | 'REJECTED';

    @ApiPropertyOptional({ description: 'Feedback/rejection note for this field' })
    @IsOptional()
    @IsString()
    note?: string;
}

export class ReviewKycDto {
    @ApiProperty({ type: [ReviewKycFieldDto], description: 'List of field reviews' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReviewKycFieldDto)
    fields: ReviewKycFieldDto[];
}
