import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlogPostDto {
    @ApiProperty({ example: 'How Car Auctions Help You Get the Best Price' })
    @IsString()
    title: string;

    /** Optional — auto-generated from the title when omitted */
    @ApiProperty({ required: false, example: 'how-car-auctions-help-you-get-the-best-price' })
    @IsString()
    @IsOptional()
    slug?: string;

    @ApiProperty({ example: 'A quick guide to getting the most out of a live auction sale.' })
    @IsString()
    @MaxLength(300)
    excerpt: string;

    @ApiProperty({ description: 'Markdown source' })
    @IsString()
    content: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    coverImage?: string;

    @ApiProperty({ required: false, default: 'CarMazium Team' })
    @IsString()
    @IsOptional()
    authorName?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @ApiProperty({ required: false, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' })
    @IsIn(['DRAFT', 'PUBLISHED'])
    @IsOptional()
    status?: 'DRAFT' | 'PUBLISHED';

    @ApiProperty({ required: false, description: 'Falls back to title when unset' })
    @IsString()
    @IsOptional()
    metaTitle?: string;

    @ApiProperty({ required: false, description: 'Falls back to excerpt when unset' })
    @IsString()
    @IsOptional()
    metaDescription?: string;
}
