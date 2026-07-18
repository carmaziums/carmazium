import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectListingDto {
    @ApiProperty({ description: 'Explanation shown to the seller of what needs fixing before resubmission' })
    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(1000)
    reason: string;
}
