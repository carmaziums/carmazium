import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKycDto {
    @ApiProperty({ description: 'Registered Company House name' })
    @IsString()
    @IsNotEmpty()
    companyHouseName: string;

    @ApiProperty({ description: 'Representative name' })
    @IsString()
    @IsNotEmpty()
    representativeName: string;

    @ApiProperty({ description: 'Representative position in the company' })
    @IsString()
    @IsNotEmpty()
    representativePosition: string;

    @ApiProperty({ description: 'VAT Number' })
    @IsString()
    @IsNotEmpty()
    vatNumber: string;

    @ApiProperty({ description: 'Company Registration Number' })
    @IsString()
    @IsNotEmpty()
    companyRegistrationNumber: string;

    @ApiProperty({ description: 'Person of Significant Control' })
    @IsString()
    @IsNotEmpty()
    personOfSignificantControl: string;

    @ApiProperty({ description: 'Director name' })
    @IsString()
    @IsNotEmpty()
    directorName: string;

    @ApiProperty({ description: 'Business Website' })
    @IsString()
    @IsNotEmpty()
    businessWebsite: string;

    @ApiProperty({ description: 'Registered Business Address' })
    @IsString()
    @IsNotEmpty()
    businessRegisteredAddress: string;

    @ApiPropertyOptional({ description: 'Trading Address if different from registered address' })
    @IsOptional()
    @IsString()
    tradingAddress?: string;

    @ApiPropertyOptional({ description: 'Google Reviews link' })
    @IsOptional()
    @IsString()
    googleReviewsLink?: string;

    @ApiProperty({ description: 'Payment reference for £1 transfer confirmation' })
    @IsString()
    @IsNotEmpty()
    paymentReference: string;

    @ApiPropertyOptional({ description: 'Stripe/Supabase URL of payment proof screenshot' })
    @IsOptional()
    @IsString()
    paymentScreenshot?: string;
}
