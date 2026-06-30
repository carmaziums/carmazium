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

    @ApiPropertyOptional({ description: 'URL to uploaded VAT certificate/proof image' })
    @IsOptional()
    @IsString()
    vatProof?: string;

    @ApiProperty({ description: 'Company Registration Number' })
    @IsString()
    @IsNotEmpty()
    companyRegistrationNumber: string;

    @ApiPropertyOptional({ description: 'URL to uploaded Company House registration certificate' })
    @IsOptional()
    @IsString()
    companyRegistrationProof?: string;

    @ApiProperty({ description: 'Person of Significant Control' })
    @IsString()
    @IsNotEmpty()
    personOfSignificantControl: string;

    @ApiProperty({ description: 'Director name' })
    @IsString()
    @IsNotEmpty()
    directorName: string;

    @ApiPropertyOptional({ description: 'URL to uploaded Director ID / Passport photo' })
    @IsOptional()
    @IsString()
    directorIdProof?: string;

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

    @ApiPropertyOptional({ description: 'Payment reference for £1 transfer confirmation (legacy — not required for Stripe-flow submissions)' })
    @IsOptional()
    @IsString()
    paymentReference?: string;

    @ApiPropertyOptional({ description: 'Supabase Storage URL of payment proof screenshot' })
    @IsOptional()
    @IsString()
    paymentScreenshot?: string;
}
