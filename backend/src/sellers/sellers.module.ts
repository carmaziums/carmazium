import { Module } from '@nestjs/common';
import { SellersService } from './sellers.service';
import { SellersController } from './sellers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [SellersController],
    providers: [SellersService],
    // SellersService is exported so ListingsService can call
    // incrementListings() and incrementSales() at key lifecycle events
    exports: [SellersService],
})
export class SellersModule { }
