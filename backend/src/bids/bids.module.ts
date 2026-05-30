import { Module, forwardRef } from '@nestjs/common';
import { BidsService } from './bids.service';
import { BidsController } from './bids.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        NotificationsModule,
        forwardRef(() => AuctionsModule),
    ],
    controllers: [BidsController],
    providers: [BidsService],
    exports: [BidsService],
})
export class BidsModule { }
