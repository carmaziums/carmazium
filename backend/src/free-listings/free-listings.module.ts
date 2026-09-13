import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FreeListingEntitlementService } from './free-listing-entitlement.service';
import { FreeListingsAdminController } from './free-listings-admin.controller';
import { FreeListingPublishMiddleware } from './free-listing-publish.middleware';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [FreeListingsAdminController],
    providers: [FreeListingEntitlementService, FreeListingPublishMiddleware],
    exports: [FreeListingEntitlementService, FreeListingPublishMiddleware],
})
export class FreeListingsModule { }
