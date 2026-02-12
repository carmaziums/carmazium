import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Chat module providing real-time messaging functionality.
 * Includes WebSocket Gateway and REST API endpoints.
 * Authentication is handled via express-session cookies.
 */
@Module({
    imports: [PrismaModule, NotificationsModule, AuthModule],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
    exports: [ChatService, ChatGateway],
})
export class ChatModule { }
