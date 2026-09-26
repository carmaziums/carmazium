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
import { DealersModule } from '../dealers/dealers.module';
import { ChatContentSafetyService } from './chat-content-safety.service';

/**
 * Chat module providing real-time messaging functionality.
 * Includes WebSocket Gateway and REST API endpoints.
 * Authentication is handled via express-session cookies.
 */
@Module({
    imports: [PrismaModule, NotificationsModule, AuthModule, ServicesModule, DealersModule],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway, ChatRateLimitService, ChatAttachmentService, ChatContentSafetyService],
    exports: [ChatService, ChatGateway, ChatRateLimitService, ChatAttachmentService, ChatContentSafetyService],
})
export class ChatModule { }
