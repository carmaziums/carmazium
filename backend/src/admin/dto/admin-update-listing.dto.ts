import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsEnum,
    IsNumber,
    IsPositive,
    IsInt,
    Min,
    Max,
    IsOptional,
    Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FuelType, Transmission, BodyType, VehicleCondition } from '../../listings/dto/create-listing.dto';

/**
 * Fields an admin can correct while a listing is awaiting review (PENDING_REVIEW
 * or REJECTED) — e.g. fixing a seller's typo before approving instead of
 * bouncing it back and forth. Deliberately narrower than CreateListingDto:
 * only the fields shown in the admin review panel are editable here.
 */
export class AdminUpdateListingDto {
    @ApiProperty({ required: false, minLength: 5, maxLength: 200 })
    @IsString()
    @IsOptional()
    @Length(5, 200)
    title?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @IsOptional()
    price?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    make?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    model?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1900)
    @Max(new Date().getFullYear() + 1)
    @IsOptional()
    year?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    mileage?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    @Length(2, 15)
    vrm?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    vin?: string;

    @ApiProperty({ enum: FuelType, required: false })
    @IsEnum(FuelType)
    @IsOptional()
    fuelType?: FuelType;

    @ApiProperty({ enum: Transmission, required: false })
    @IsEnum(Transmission)
    @IsOptional()
    transmission?: Transmission;

    @ApiProperty({ enum: BodyType, required: false })
    @IsEnum(BodyType)
    @IsOptional()
    bodyType?: BodyType;

    @ApiProperty({ enum: VehicleCondition, required: false })
    @IsEnum(VehicleCondition)
    @IsOptional()
    condition?: VehicleCondition;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    color?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(8)
    @IsOptional()
    doors?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    @IsOptional()
    seats?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location?: string;
}
