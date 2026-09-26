import { IsString, IsOptional, IsEnum, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType } from '@prisma/client';

export class ReviewKycFieldDto {
    @ApiProperty({ description: 'The field name being approved or rejected (e.g. companyHouseName)' })
    @IsString()
    field: string;

    @ApiProperty({ description: 'Review status for this specific field', enum: ['APPROVED', 'REJECTED'] })
    @IsIn(['APPROVED', 'REJECTED'])
    status: 'APPROVED' | 'REJECTED';

    @ApiPropertyOptional({ description: 'Feedback/rejection note for this field' })
    @IsOptional()
    @IsString()
    note?: string;
}

export class ReviewKycDto {
    @ApiPropertyOptional({
        enum: BusinessType,
        description: 'Optional admin correction to the applicant business type. Used to apply the correct KYC ruleset during this review.',
    })
    @IsOptional()
    @IsEnum(BusinessType)
    businessType?: BusinessType;

    @ApiProperty({ type: [ReviewKycFieldDto], description: 'List of field reviews' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReviewKycFieldDto)
    fields: ReviewKycFieldDto[];
}
