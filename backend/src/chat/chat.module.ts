import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { ChatRateLimitService } from './chat-rate-limit.service';
import { ChatAttachmentService } from './chat-attachment.service';
import { ServicesModule } from '../services/services.module';

/**
 * Chat module providing real-time messaging functionality.
 * Includes WebSocket Gateway and REST API endpoints.
 * Authentication is handled via express-session cookies.
 */
@Module({
    imports: [PrismaModule, NotificationsModule, AuthModule, ServicesModule],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway, ChatRateLimitService, ChatAttachmentService],
    exports: [ChatService, ChatGateway, ChatRateLimitService, ChatAttachmentService],
})
export class ChatModule { }
