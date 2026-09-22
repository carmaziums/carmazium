import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

/**
 * Full retail listing payload used when a seller chooses to replace an
 * existing auction with a retail listing. Reusing CreateListingDto means the
 * same vehicle/form validation applies as a normal new listing.
 *
 * The service still forces CLASSIFIED + DRAFT and rejects auction scheduling
 * fields; the boolean is an explicit server-side acknowledgement that this
 * action may cancel an active/scheduled auction.
 */
export class ConvertAuctionToRetailDto extends CreateListingDto {
    @ApiProperty({
        description: 'Explicit confirmation that the seller accepts cancellation of the existing auction before switching to retail.',
        example: true,
    })
    @IsBoolean()
    confirmAuctionCancellation: boolean;
}
