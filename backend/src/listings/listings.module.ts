import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SellersModule } from '../sellers/sellers.module';
import { ScraperModule } from '../scraper/scraper.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TradeListingAccessGuard } from '../auctions/trade-access.guard';
import { FreeListingsModule } from '../free-listings/free-listings.module';
import { FreeListingPublishMiddleware } from '../free-listings/free-listing-publish.middleware';

@Module({
  imports: [PrismaModule, AuthModule, SellersModule, ConfigModule, ScraperModule, NotificationsModule, FreeListingsModule],
  controllers: [ListingsController],
  providers: [ListingsService, TradeListingAccessGuard],
  exports: [ListingsService],
})
export class ListingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(FreeListingPublishMiddleware)
      .forRoutes({ path: 'listings/:id/publish', method: RequestMethod.POST });
  }
}
