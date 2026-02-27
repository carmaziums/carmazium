import { Module } from '@nestjs/common';
import { ImageCleanupService } from './image-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { FeaturedBoostModule } from '../featured-boost/featured-boost.module';
import { FeaturedBoostExpiryService } from './featured-boost-expiry.service';

@Module({
    imports: [
        PrismaModule,
        ConfigModule,
        FeaturedBoostModule,
    ],
    providers: [ImageCleanupService, FeaturedBoostExpiryService],
})
export class TasksModule { }

