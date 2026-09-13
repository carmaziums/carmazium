import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFreeListingsController } from './free-listings.controller';
import { FreeListingGrantInterceptor } from './free-listing-grants.interceptor';
import { FreeListingGrantsService } from './free-listing-grants.service';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [AdminFreeListingsController],
    providers: [
        FreeListingGrantsService,
        {
            provide: APP_INTERCEPTOR,
            useClass: FreeListingGrantInterceptor,
        },
    ],
    exports: [FreeListingGrantsService],
})
export class FreeListingsModule {}
