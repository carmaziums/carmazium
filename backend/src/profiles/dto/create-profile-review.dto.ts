import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfileReviewDto {
    @ApiProperty({ description: 'Star rating from 1 to 5', minimum: 1, maximum: 5, example: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiPropertyOptional({ description: 'Optional written review', example: 'Clear communication and a smooth handover.' })
    @IsOptional()
    @IsString()
    @MinLength(5)
    @MaxLength(1000)
    comment?: string;
}
