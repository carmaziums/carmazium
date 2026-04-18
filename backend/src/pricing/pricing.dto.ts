import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class EstimatePriceDto {
    @IsString()
    @IsNotEmpty()
    make: string;

    @IsString()
    @IsNotEmpty()
    model: string;

    @IsNumber()
    @IsNotEmpty()
    year: number;

    @IsNumber()
    @IsNotEmpty()
    mileage: number;

    @IsString()
    @IsOptional()
    fuelType?: string;

    @IsString()
    @IsOptional()
    transmission?: string;

    @IsString()
    @IsOptional()
    condition?: string;

    @IsString()
    @IsOptional()
    location?: string;

    @IsNumber()
    @IsOptional()
    damageImageCount?: number;
}
