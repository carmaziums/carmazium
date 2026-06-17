import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SellersModule } from '../sellers/sellers.module';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [PrismaModule, AuthModule, SellersModule, ConfigModule, ScraperModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule { }
