import { IsUUID, IsNotEmpty, IsObject, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeliveryAddressDto {
  @ApiProperty({ description: 'Street address', example: '1 High Street' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ description: 'City', example: 'London' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'UK postcode', example: 'SW1A 1AA' })
  @IsString()
  @IsNotEmpty()
  postcode: string;
}

export class CreateDeliveryRequestDto {
  @ApiProperty({ description: 'UUID of the listing', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  @ApiProperty({ description: 'Delivery address', type: DeliveryAddressDto })
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress: DeliveryAddressDto;

  @ApiPropertyOptional({ description: 'Optional delivery notes', example: 'Gate code is 1234' })
  @IsString()
  @IsOptional()
  deliveryNotes?: string;
}
