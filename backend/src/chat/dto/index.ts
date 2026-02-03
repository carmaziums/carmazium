import { IsNotEmpty, IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';
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
 * DTO for marking messages as read
 */
export class MarkReadDto {
    @IsOptional()
    @IsUUID()
    messageId?: string;
}
