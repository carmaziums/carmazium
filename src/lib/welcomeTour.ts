export const WELCOME_TOUR_VERSION = 1
// Existing accounts can replay from Settings without an unexpected full-screen tour.
export const WELCOME_TOUR_LAUNCH = "2026-11-15T14:55:00.000Z"

export type TourProfile = {
    id: string
    role: string
    createdAt?: string
    preferences?: Record<string, unknown>
    dealerProfile?: unknown
    contractorProfile?: unknown
    dealerStaffMemberships?: unknown[]
}
export type TourStep = { title: string; description: string; points: string[] }

export function canAutoIntroduce(profile: TourProfile, pathname: string, search: string) {
    const safePages = ["/", "/search", "/buy-cars", "/dashboard", "/dashboard/user", "/dashboard/buyer", "/dashboard/seller", "/dashboard/dealer", "/dashboard/partner", "/dashboard/finance", "/dashboard/insurance"]
    return profile.role !== "ADMIN"
        && Number.isFinite(Date.parse(profile.createdAt ?? ""))
        && Date.parse(profile.createdAt!) >= Date.parse(WELCOME_TOUR_LAUNCH)
        && !profile.preferences?.websiteIntroductionV1
        && safePages.includes(pathname)
        && !search
}

export function getWelcomeSteps(profile: TourProfile): TourStep[] {
    const dealer = !!profile.dealerProfile || profile.role === "DEALER" || !!profile.dealerStaffMemberships?.length
    const provider = !!profile.contractorProfile || profile.role === "CONTRACTOR"
    const partner = ["FINANCE_PARTNER", "INSURANCE_PARTNER"].includes(profile.role)
    const steps: TourStep[] = [{
        title: "Welcome to CarMazium",
        description: "A quick introduction to buying, selling and managing your account.",
        points: ["Use the main menu to find Buy, Sell and business services.", "Your dashboard brings together the activity for your account.", "Skip at any time. You can replay this introduction in Account Settings."],
    }, {
        title: "Find your next vehicle",
        description: "Browse retail listings and use filters to narrow your search.",
        points: ["Filter by vehicle type, make, model, price and other available details.", "Open a listing to review photographs, the seller’s information and available services.", "Save vehicles to your watchlist and contact the seller through the listing."],
    }, {
        title: "Choose how to sell",
        description: "Choose a free dealer auction or a basic retail listing for £1 until sold.",
        points: ["Start from Sell, choose your vehicle type and follow the listing steps.", "Upload your own photographs, describe the condition honestly and review before submitting. Listings are subject to admin approval.", "Caravans are entered manually with your own price or auction estimate. No registration, VIN, mileage or automated valuation is needed."],
    }, {
        title: dealer ? "Buying at dealer auctions" : "How dealer auctions work",
        description: dealer ? "Verified dealer accounts can bid on live auctions." : "Sellers can list for auction; bidding is for verified dealers.",
        points: ["Read the listing and auction terms before placing a bid. Check the current bid, next minimum bid and closing time.", "Track bids, offers and purchases in your dashboard. A provisional offer still needs the seller’s decision.", "The winning dealer pays the £125 auction buyer fee. Vehicle funds are paid directly to the seller; follow the handover steps before confirming completion."],
    }]
    if (dealer) steps.push({
        title: "Your dealership services",
        description: "Manage your service options in Account Settings → Business.",
        points: ["Finance and warranty badges apply only to your own listings. Buyers contact you for details. Turn off any service you do not offer.", "Collection, delivery and recovery require approved business verification, verified payouts and trade insurance. Inspection requires business verification, verified payouts and a declaration.", "Your £1 dealer account verification is paid once. Service setup does not require another £1 verification payment. Enabling a service does not approve you for jobs."],
    })
    else if (provider) steps.push({
        title: "Provide services through TradeXchange",
        description: "Use your service dashboard to manage applications and eligible jobs.",
        points: ["Complete business verification and payout setup before taking paid work.", "Collection, delivery and recovery require trade insurance. Inspection requires the business declaration, with no inspection documents to upload.", "Check approval status in service setup. Turning an option on does not approve an application."],
    })
    else if (partner) steps.push({
        title: "Your partnership dashboard",
        description: "Manage the enquiries and activity available to your approved partnership.",
        points: ["Use your dashboard to review incoming enquiries and their status.", "Keep your business and contact details up to date in Account Settings.", "Partnerships and provider access are managed by CarMazium’s admin team."],
    })
    steps.push({
        title: "Stay in control",
        description: "Your dashboard and Account Settings are always available from your account menu.",
        points: ["Check messages, notifications and listing progress regularly. Use Support if you need help.", "Manage your profile, security, notifications and payout details in Account Settings.", "Review fees and payment details before confirming. Never confirm a vehicle handover until the required checks are complete and the seller has received the funds."],
    })
    return steps
}
