import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { HpiModule } from '../hpi/hpi.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [PrismaModule, AuthModule, ConfigModule, HpiModule, NotificationsModule, EmailModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
