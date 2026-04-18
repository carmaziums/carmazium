import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';
import { ScraperCron } from './scraper.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [PrismaModule, ConfigModule, ScheduleModule.forRoot()],
    providers: [ScraperService, ScraperCron],
    exports: [ScraperService],
})
export class ScraperModule {}
