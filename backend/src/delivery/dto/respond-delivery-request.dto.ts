import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RespondDeliveryRequestDto {
  @ApiPropertyOptional({ description: 'Optional message when responding to the delivery request' })
  @IsString()
  @IsOptional()
  message?: string;
}
