import { RetailCollectionsController } from './retail-collections.controller';
import { EmailModule } from '../email/email.module';
import { GuestEnquiryController } from './guest-enquiry.controller';
import { GuestEnquiryService } from './guest-enquiry.service';
import { Module } from '@nestjs/common';
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
import { DealersModule } from '../dealers/dealers.module';
import { DvlaModule } from '../dvla/dvla.module';

@Module({
  imports: [EmailModule, PrismaModule, AuthModule, SellersModule, ConfigModule, ScraperModule, NotificationsModule, FreeListingsModule, DealersModule, DvlaModule],
  controllers: [RetailCollectionsController, ListingsController, GuestEnquiryController],
  providers: [GuestEnquiryService, ListingsService, TradeListingAccessGuard],
  exports: [ListingsService],
})
export class ListingsModule { }
