import { IsIn, IsInt, IsNotEmpty, IsString, IsUUID, IsOptional, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating or finding a chat room between two users
 */
export class CreateRoomDto {
    @ApiProperty({ description: 'ID of the user to chat with' })
    @IsNotEmpty()
    @IsUUID()
    participantId: string;

    @ApiPropertyOptional({ description: 'Optional listing ID to link conversation to' })
    @IsOptional()
    @IsUUID()
    listingId?: string;
}

/**
 * DTO for sending a message
 */
export class SendMessageDto {
    @ApiProperty({ description: 'Message content', maxLength: 2000 })
    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    content: string;

    @ApiPropertyOptional({
        description: 'Client-generated UUID used to make retries idempotent',
    })
    @IsOptional()
    @IsUUID()
    clientMessageId?: string;
}

/**
 * DTO for WebSocket message events
 */
export class WsMessageDto {
    @IsNotEmpty()
    @IsUUID()
    roomId: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    content: string;

    @IsOptional()
    @IsUUID()
    clientMessageId?: string;
}

/**
 * DTO for typing indicator events
 */
export class WsTypingDto {
    @IsNotEmpty()
    @IsUUID()
    roomId: string;
}

/**
 * DTO for room:join and message:read events (roomId only)
 */
export class WsRoomIdDto {
    @IsNotEmpty()
    @IsUUID()
    roomId: string;
}

/**
 * DTO for marking messages as read
 */
export class MarkReadDto {
    @IsOptional()
    @IsUUID()
    messageId?: string;
}


export class CreateChatAttachmentUploadDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @IsString()
    @IsIn(['image/jpeg', 'image/png', 'image/webp'])
    mime: string;

    @IsInt()
    @Min(1)
    @Max(10 * 1024 * 1024)
    size: number;
}

export class OpenDisputeDto {
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

export class SendChatAttachmentDto extends CreateChatAttachmentUploadDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    path: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    caption?: string;

    @IsOptional()
    @IsUUID()
    clientMessageId?: string;
}
