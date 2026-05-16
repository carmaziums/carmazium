import { Module, forwardRef } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { AuctionGateway } from './auction.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BidsModule } from '../bids/bids.module';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        NotificationsModule,
        forwardRef(() => BidsModule),
    ],
    controllers: [AuctionsController],
    providers: [AuctionsService, AuctionGateway],
    exports: [AuctionsService, AuctionGateway],
})
export class AuctionsModule { }
