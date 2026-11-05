import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ValuationHistoryService } from './valuation-history.service';
import { OnlinePresenceService } from './online-presence.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [AnalyticsController],
    providers: [AnalyticsService, ValuationHistoryService, OnlinePresenceService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
