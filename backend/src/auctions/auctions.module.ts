/* ============================================================================
 * AUCTIONS MODULE — FROZEN
 * ============================================================================
 * The AuctionsService and controller are frozen. PrismaModule and AuthModule
 * imports are preserved in comments for when auctions are re-enabled.
 * ============================================================================ */

import { Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';

/* AUCTION_DISABLED — restore these imports when re-enabling auctions
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
*/

@Module({
    // AUCTION_DISABLED: imports: [PrismaModule, AuthModule],
    imports: [],
    controllers: [AuctionsController],
    providers: [AuctionsService],
    // AUCTION_DISABLED: exports: [AuctionsService],
})
export class AuctionsModule { }
