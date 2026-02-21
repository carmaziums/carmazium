import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSellerReviewDto {
    @ApiProperty({ description: 'SellerProfile ID of the seller being reviewed', example: 'uuid' })
    @IsUUID()
    sellerId: string;

    @ApiPropertyOptional({ description: 'Listing ID the review is associated with', example: 'uuid' })
    @IsOptional()
    @IsUUID()
    listingId?: string;

    @ApiProperty({ description: 'Star rating from 1 to 5', minimum: 1, maximum: 5, example: 4 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiPropertyOptional({ description: 'Optional written review comment', example: 'Great seller, fast responses.' })
    @IsOptional()
    @IsString()
    @MinLength(10)
    comment?: string;
}
