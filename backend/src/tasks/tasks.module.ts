import { Module } from '@nestjs/common';
import { ImageCleanupService } from './image-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { FeaturedBoostModule } from '../featured-boost/featured-boost.module';
import { FeaturedBoostExpiryService } from './featured-boost-expiry.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { AuctionsModule } from '../auctions/auctions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        PrismaModule,
        ConfigModule,
        FeaturedBoostModule,
        AuctionsModule,
        NotificationsModule,
    ],
    providers: [ImageCleanupService, FeaturedBoostExpiryService, AuctionLifecycleService],
})
export class TasksModule { }
