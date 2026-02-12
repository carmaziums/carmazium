import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

export class CreateFinanceApplicationDto {
    @ApiProperty({ description: 'UUID of the listing being financed' })
    @IsUUID()
    listingId: string;

    @ApiProperty({ description: 'UUID of the finance partner' })
    @IsUUID()
    partnerId: string;

    @ApiProperty({ description: 'Deposit amount', example: 5000 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    depositAmount: number;

    @ApiProperty({ description: 'Term in months', example: 48 })
    @Type(() => Number)
    @IsInt()
    @Min(12)
    termMonths: number;
}
