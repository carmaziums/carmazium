import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto';

/**
 * Seller-editable listing fields.
 *
 * Lifecycle/commercial fields are deliberately excluded from the generic PATCH
 * route. They must go through the dedicated publish/status/payment/auction
 * endpoints so sellers cannot bypass review, fees, or auction orchestration.
 */
export class UpdateListingDto extends PartialType(
    OmitType(CreateListingDto, [
        'status',
        'listingType',
        'badgeTier',
        'auctionStartTime',
        'auctionReservePrice',
        'auctionMinIncrement',
        'auctionBuyItNowPrice',
        'auctionStartingBid',
    ] as const),
) { }
