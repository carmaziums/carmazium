import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationEmailOutboxService } from './notification-email-outbox.service';

@Module({
    imports: [PrismaModule, AuthModule, EmailModule],
    controllers: [NotificationsController],
    providers: [
        NotificationsService,
        NotificationsGateway,
        NotificationEmailOutboxService,
        { provide: 'NotificationsGateway', useExisting: NotificationsGateway },
    ],
    exports: [NotificationsService, NotificationsGateway, 'NotificationsGateway'],
})
export class NotificationsModule { }
