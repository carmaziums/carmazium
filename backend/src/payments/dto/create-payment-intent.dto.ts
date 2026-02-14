import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentIntentDto {
    @ApiProperty({ description: 'Amount in smallest currency unit (e.g. cents)', minimum: 1 })
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    amount: number;

    @ApiPropertyOptional({ description: 'ISO 4217 currency code (e.g. usd)', default: 'usd' })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string;
}
