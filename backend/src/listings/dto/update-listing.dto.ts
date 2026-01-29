import { PartialType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto';
import { IsOptional, IsArray, IsString } from 'class-validator';

export class UpdateListingDto extends PartialType(CreateListingDto) {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    images?: string[];
}
