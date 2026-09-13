import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminMessagingController } from './admin-messaging.controller';
import { AdminMessagingService } from './admin-messaging.service';

@Module({
    imports: [PrismaModule, AuthModule, ChatModule, NotificationsModule],
    controllers: [AdminMessagingController],
    providers: [AdminMessagingService],
})
export class AdminMessagingModule {}
