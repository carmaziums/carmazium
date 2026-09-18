import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { AuctionsModule } from '../auctions/auctions.module';

@Module({
    imports: [PrismaModule, NotificationsModule, AuthModule, EmailModule, AuctionsModule],
    controllers: [OffersController],
    providers: [OffersService],
    exports: [OffersService],
})
export class OffersModule { }
