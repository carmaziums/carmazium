import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateAuctionDigestDto {
    @ApiPropertyOptional({
        description: 'Custom tags/batch labels the seller applies to their own auction listing',
        example: ['Track Day Ready', 'One Owner'],
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    @MaxLength(30, { each: true })
    customTags?: string[];

    @ApiPropertyOptional({ description: 'Seller self-rating for this listing, 1-5', example: 5, minimum: 1, maximum: 5 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    sellerSelfRating?: number;
}
