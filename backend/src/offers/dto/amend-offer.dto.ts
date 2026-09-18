import { ApiProperty } from '@nestjs/swagger';
import {
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AmendOfferDto {
    @ApiProperty({ description: 'Updated offer amount in GBP', example: 12500 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    amount: number;

    @ApiProperty({ description: 'Optional updated minimum offer amount', required: false, example: 12000 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    amountMin?: number;

    @ApiProperty({ description: 'Optional updated maximum offer amount', required: false, example: 12500 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    amountMax?: number;

    @ApiProperty({ description: 'Optional updated message to the seller', required: false, example: 'I can collect tomorrow.' })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    message?: string;
}
