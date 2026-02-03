import { Module } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [WatchlistController],
    providers: [WatchlistService],
    exports: [WatchlistService],
})
export class WatchlistModule { }
