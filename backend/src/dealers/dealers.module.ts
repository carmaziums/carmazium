import { Module } from '@nestjs/common';
import { DealersService } from './dealers.service';
import { DealersController } from './dealers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PrismaModule, AuthModule, EmailModule, NotificationsModule],
    controllers: [DealersController],
    providers: [DealersService],
    exports: [DealersService],
})
export class DealersModule {}

