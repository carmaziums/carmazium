/**
 * Customer-facing next steps for the backend's same-seller / same-VRM
 * duplicate protection. Never invite a seller to create another vehicle row.
 *
 * "Put to Auction" is only available on ACTIVE retail listings in My Listings.
 * "Also Retail" is offered on ACTIVE/SCHEDULED auctions in My Auctions.
 */
export interface ExistingListingGuidance {
    heading: string
    status: string
    explanation: string
    steps: string[]
    href: string
    actionLabel: string
    extraHref?: string
    extraActionLabel?: string
}

export function getExistingListingGuidance(message: string): ExistingListingGuidance | null {
    const match = /^This vehicle already has an existing (classified|auction) listing \(([^)]+)\)\./i.exec(message.trim())
    if (!match) return null
    const isRetail = match[1].toUpperCase() === 'CLASSIFIED'
    const status = match[2].trim().toUpperCase()
    const retailHref = '/dashboard/user?tab=inventory'
    const auctionHref = '/dashboard/seller/auctions'

    if (isRetail) {
        const shared = {
            heading: 'Your vehicle is already listed in Retail',
            status: status === 'PENDING_REVIEW' ? 'Under review' : status === 'ACTIVE' ? 'Live' : status === 'REJECTED' ? 'Needs attention' : status === 'DRAFT' ? 'Draft' : status.replace(/_/g, ' ').toLowerCase(),
            href: retailHref,
            actionLabel: 'Open My Listings',
        }
        if (status === 'ACTIVE') return {
            ...shared,
            explanation: 'You can put this vehicle into an auction without uploading it again. Your live Retail listing will remain in place.',
            steps: [
                'Open My Listings and find this vehicle.',
                'Select More options (the three dots on desktop) then Put to Auction.',
                'Choose the auction start time, reserve and bidding details, then submit it for review.',
            ],
        }
        if (status === 'PENDING_REVIEW') return {
            ...shared,
            explanation: 'Your Retail listing has already been submitted and is awaiting approval. The Put to Auction action becomes available after it is Live.',
            steps: [
                'Open My Listings to see the existing vehicle and its Under Review status.',
                'Wait for CarMazium to approve the Retail listing.',
                'Once it shows Live, open More options and choose Put to Auction. Confirm the auction details and submit.',
            ],
        }
        if (status === 'DRAFT' || status === 'REJECTED') return {
            ...shared,
            explanation: status === 'DRAFT' ? 'Finish your saved Retail listing first. There is no need to start over.' : 'Your existing Retail listing needs corrections before it can be published.',
            steps: [
                'Open My Listings and find this vehicle.',
                status === 'DRAFT' ? 'Edit or Publish the draft and complete any required Retail payment.' : 'Choose Edit, correct the issue and resubmit for approval.',
                'After it is approved and Live, use More options → Put to Auction.',
            ],
        }
        return {
            ...shared,
            explanation: 'A Retail listing already exists for this registration. A sale-pending or completed vehicle must not be placed into another auction.',
            steps: ['Open My Listings and check the vehicle status.', 'Resolve any pending sale or listing restriction before requesting a channel change.'],
        }
    }

    const shared = {
        heading: 'Your vehicle already has an Auction listing',
        status: status === 'PENDING_REVIEW' ? 'Under review' : status === 'ACTIVE' ? 'Live' : status === 'DRAFT' ? 'Draft' : status.replace(/_/g, ' ').toLowerCase(),
        href: auctionHref,
        actionLabel: 'Open My Auctions',
    }
    if (status === 'ACTIVE' || status === 'PENDING_REVIEW') return {
        ...shared,
        explanation: status === 'PENDING_REVIEW'
            ? 'Your Auction listing is awaiting approval. Do not create another listing for the same vehicle.'
            : 'To advertise in Retail as well, use the existing auction rather than re-uploading the vehicle.',
        steps: [
            'Open My Auctions and find your vehicle.',
            status === 'PENDING_REVIEW' ? 'Wait until the auction is approved and the Also Retail option is available.' : 'Choose Also Retail for the existing auction.',
            'Enter your Retail asking price, choose a package (Basic £1), and complete the payment and review steps.',
        ],
        extraHref: retailHref,
        extraActionLabel: 'View My Listings',
    }
    if (status === 'DRAFT' || status === 'REJECTED') return {
        ...shared,
        explanation: 'Complete or correct the existing Auction listing first. It is not necessary to create a second auction.',
        steps: [
            'Open My Listings to edit the saved listing or resubmit it for review.',
            'When the auction is approved and available in My Auctions, select Also Retail.',
            'Set the Retail price and complete the normal Retail payment and review steps.',
        ],
        href: retailHref,
        actionLabel: 'Open My Listings',
        extraHref: auctionHref,
        extraActionLabel: 'View My Auctions',
    }
    return {
        ...shared,
        explanation: 'An Auction record already exists for this vehicle. Check its result and any transaction before listing it elsewhere.',
        steps: ['Open My Auctions and find the vehicle.', 'Use the available post-auction Retail options, if permitted; completed sales and winner commitments cannot be bypassed.'],
    }
}
