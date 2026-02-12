import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CreateInsuranceQuoteDto {
    @ApiProperty({ description: 'UUID of the listing to insure' })
    @IsUUID()
    listingId: string;

    @ApiProperty({ description: 'UUID of the insurance partner' })
    @IsUUID()
    partnerId: string;

    @ApiProperty({ description: 'Driver age', example: 30 })
    @Type(() => Number)
    @IsInt()
    @Min(17)
    driverAge: number;

    @ApiProperty({ description: 'Years of No Claims Bonus', example: 5 })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    ncbYears: number;

    @ApiProperty({ description: 'Has driving convictions?' })
    @IsBoolean()
    hasConvictions: boolean;
}
