import { IsString, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
    @IsString()
    type: string; // page_view, search, listing_view, filter_apply, login_wall_hit, enquiry

    @IsOptional()
    @IsObject()
    payload?: Record<string, any>;

    @IsOptional()
    @IsString()
    sessionId?: string;

    @IsOptional()
    @IsString()
    userId?: string;
}
