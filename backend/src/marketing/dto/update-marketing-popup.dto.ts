import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateMarketingPopupDto {
    @ApiProperty({ description: 'Whether the popup shows to signed-out visitors', example: true, required: false })
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @ApiProperty({ description: 'Public URL of the promo image (Supabase storage)', required: false })
    @IsString()
    @IsUrl()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({ description: 'Where clicking the popup image navigates to', example: '/auctions', required: false })
    @IsString()
    @IsOptional()
    linkUrl?: string;
}
