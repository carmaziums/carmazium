import { Module, forwardRef } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { AuctionGateway } from './auction.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BidsModule } from '../bids/bids.module';
import { EmailModule } from '../email/email.module';
import { ChatModule } from '../chat/chat.module';
import { TradeAuctionAccessGuard } from './trade-access.guard';
import { HandoverDocumentsService } from './handover-documents.service';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        NotificationsModule,
        forwardRef(() => BidsModule),
        EmailModule,
        forwardRef(() => ChatModule),
    ],
    controllers: [AuctionsController],
    providers: [AuctionsService, AuctionGateway, TradeAuctionAccessGuard, HandoverDocumentsService],
    exports: [AuctionsService, AuctionGateway, HandoverDocumentsService],
})
export class AuctionsModule { }