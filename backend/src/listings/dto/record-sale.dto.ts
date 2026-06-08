import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RecordSaleDto {
    @ApiProperty({
        description: 'The final price the vehicle was sold for',
        example: 15500.00,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    soldPrice: number;

    @ApiProperty({
        description: 'The ID of the buyer who purchased the vehicle',
        example: '123e4567-e89b-12d3-a456-426614174000',
        required: false,
    })
    @IsOptional()
    @IsUUID()
    buyerId?: string;

    @ApiProperty({
        description: 'Optional name of the buyer if they are not a registered user',
        example: 'John Doe',
        required: false,
    })
    @IsOptional()
    @IsString()
    buyerName?: string;

    @ApiProperty({
        description: 'Optional email of the buyer',
        example: 'buyer@example.com',
        required: false,
    })
    @IsOptional()
    @IsString()
    buyerEmail?: string;
}
