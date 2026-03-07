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
