import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuctionsService } from '../auctions/auctions.service';

@Injectable()
export class UnpaidAuctionFeeExpiryService {
    private readonly logger = new Logger(UnpaidAuctionFeeExpiryService.name);

    constructor(private readonly auctionsService: AuctionsService) { }

    /**
     * Runs hourly. Cancels any auction win whose £125 buyer fee hasn't been
     * paid within the grace window (see BUYER_FEE_GRACE_MS in AuctionsService),
     * relisting the vehicle and notifying both parties.
     */
    @Cron('0 * * * *')
    async handleUnpaidAuctionFeeExpiry(): Promise<void> {
        try {
            const result = await this.auctionsService.revertUnpaidWins();
            if (result.reverted > 0) {
                this.logger.log(`Reverted ${result.reverted} unpaid auction win(s).`);
            }
        } catch (err) {
            this.logger.error('Error during unpaid auction fee expiry check:', err);
        }
    }
}
