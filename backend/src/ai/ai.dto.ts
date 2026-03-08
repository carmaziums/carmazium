import { IsString, IsNotEmpty, IsArray, ValidateNested, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AiSearchDto {
    @IsString()
    @IsNotEmpty()
    query: string;
}

class ChatMessageDto {
    @IsString()
    @IsIn(['user', 'assistant'])
    role: 'user' | 'assistant';

    @IsString()
    @IsNotEmpty()
    content: string;
}

export class AiChatDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChatMessageDto)
    messages: ChatMessageDto[];
}

export class AiDescriptionDto {
    @IsOptional()
    @IsString()
    make?: string;

    @IsOptional()
    @IsString()
    model?: string;

    @IsOptional()
    @IsString()
    year?: string;

    @IsOptional()
    @IsString()
    mileage?: string;

    @IsOptional()
    @IsString()
    condition?: string;

    @IsOptional()
    @IsString()
    fuelType?: string;

    @IsOptional()
    @IsString()
    transmission?: string;

    @IsOptional()
    @IsString()
    color?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];

    @IsOptional()
    @IsString()
    vrm?: string;

    @IsOptional()
    @IsString()
    motStatus?: string;
}
