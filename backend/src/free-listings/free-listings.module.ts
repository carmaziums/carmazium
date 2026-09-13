import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FreeListingGrantsService } from './free-listing-grants.service';

@Module({
    imports: [PrismaModule],
    providers: [FreeListingGrantsService],
    exports: [FreeListingGrantsService],
})
export class FreeListingsModule {}
