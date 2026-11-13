import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { WarrantiesService } from './warranties.service';
import { AdminWarrantyOrdersController, WarrantiesController } from './warranties.controller';

@Module({
    imports: [PrismaModule, AuthModule, PaymentsModule, NotificationsModule, EmailModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
    controllers: [WarrantiesController, AdminWarrantyOrdersController], providers: [WarrantiesService], exports: [WarrantiesService],
})
export class WarrantiesModule {}
