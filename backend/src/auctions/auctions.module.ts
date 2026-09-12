import { Module, forwardRef } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { AuctionGateway } from './auction.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BidsModule } from '../bids/bids.module';
import { EmailModule } from '../email/email.module';
import { TradeAuctionAccessGuard } from './trade-access.guard';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        NotificationsModule,
        forwardRef(() => BidsModule),
        EmailModule,
    ],
    controllers: [AuctionsController],
    providers: [AuctionsService, AuctionGateway, TradeAuctionAccessGuard],
    exports: [AuctionsService, AuctionGateway],
})
export class AuctionsModule { }