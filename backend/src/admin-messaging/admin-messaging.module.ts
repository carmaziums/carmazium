import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminMessagingController } from './admin-messaging.controller';
import { AdminMessagingService } from './admin-messaging.service';
import { AdminBroadcastSchedulerService } from './admin-broadcast-scheduler.service';

@Module({
    imports: [PrismaModule, AuthModule, ChatModule, NotificationsModule, EmailModule],
    controllers: [AdminMessagingController],
    providers: [AdminMessagingService, AdminBroadcastSchedulerService],
})
export class AdminMessagingModule {}
