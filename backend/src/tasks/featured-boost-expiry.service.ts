import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FeaturedBoostService } from '../featured-boost/featured-boost.service';

@Injectable()
export class FeaturedBoostExpiryService {
    private readonly logger = new Logger(FeaturedBoostExpiryService.name);

    constructor(private readonly featuredBoostService: FeaturedBoostService) { }

    /**
     * Runs daily at 2:00 AM UTC.
     * Expires all FeaturedBoost records whose expiresAt has passed,
     * and resets the corresponding Listing.isFeatured flags.
     */
    @Cron('0 2 * * *')
    async handleFeaturedBoostExpiry(): Promise<void> {
        this.logger.log('Running featured boost expiry check...');

        try {
            const result = await this.featuredBoostService.expireBoosts();
            this.logger.log(`Featured boost expiry complete. Expired: ${result.expired} boosts.`);
        } catch (err) {
            this.logger.error('Error during featured boost expiry:', err);
        }
    }
}
