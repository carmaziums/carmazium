import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ValuationHistoryService } from './valuation-history.service';
import { OnlinePresenceService } from './online-presence.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ApprovedAuctionConversionsService } from './approved-auction-conversions';
import { ApprovedAuctionConversionsController } from './approved-auction-conversions.controller';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [AnalyticsController, ApprovedAuctionConversionsController],
    providers: [AnalyticsService, ValuationHistoryService, OnlinePresenceService, ApprovedAuctionConversionsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
