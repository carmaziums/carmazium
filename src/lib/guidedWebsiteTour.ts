import type { TourProfile } from "./welcomeTour"

export type GuidedStep = {
    id: string
    title: string
    description: string
    href?: string
    target?: { selector: string; text?: string }
}

/** Navigation and explanations only: no tour step submits or changes account data. */
export function getGuidedWebsiteSteps(profile: TourProfile): GuidedStep[] {
    const dealer = profile.role === "DEALER"
    const contractor = profile.role === "CONTRACTOR"
    const specialist = ["FINANCE_PARTNER", "INSURANCE_PARTNER"].includes(profile.role)
    const home = dealer ? "/dashboard/dealer" : contractor ? "/dashboard/partner" : profile.role === "FINANCE_PARTNER" ? "/dashboard/finance" : profile.role === "INSURANCE_PARTNER" ? "/dashboard/insurance" : "/dashboard/user"
    const heading = { selector: "main h1, main h2" }
    const steps: GuidedStep[] = [{
        id: "welcome", title: "Let’s explore CarMazium", description: "This walkthrough opens the relevant pages and highlights the options as we explain them. Use Next and Back, jump to a topic, or skip at any time. Turn on voice guidance if you would like the explanations read aloud. Your account permissions still apply. No forms, bids or payments are submitted by the tour.",
    }, {
        id: "home", title: "Your dashboard", href: home, target: heading,
        description: "Your dashboard brings together your listings, purchases and account activity. It is your starting point whenever you sign in. The account menu also takes you to Account Settings.",
    }, {
        id: "search", title: "Find a vehicle", href: "/search", target: { selector: "[data-tour=search-filters]" },
        description: "Use the filters to choose cars, caravans and campervans, motorcycles or commercial vehicles. Narrow the results by make, model, price and other details, then apply your filters. Open a listing to inspect photographs and contact the seller.",
    }, {
        id: "sell", title: "Choose how to sell", href: "/sell", target: { selector: "#sell-options h2" },
        description: "Choose auction or retail, then follow the listing form. Dealer auctions are free to list. Basic retail listings cost £1 until sold. Caravans use manual details and your own price or estimate; CarMazium does not generate a caravan valuation.",
    }, {
        id: "pricing", title: "Listing packages", href: "/pricing", target: heading,
        description: "Compare Basic, Standard and Premium before choosing a retail package. Check the included features and price. Payment and admin approval requirements still apply; this walkthrough never purchases a package.",
    }]
    if (dealer) steps.push(
        { id: "stock", title: "Manage your stock", href: "/dashboard/dealer/inventory", target: { selector: "input[aria-label='Search stock by make, model or registration']" }, description: "Search your stock by vehicle or registration. Use Live, Under review, Rejected, Draft and Sold to see each stage. The action menu on a vehicle gives you its available viewing and management options." },
        { id: "add", title: "Add a vehicle", href: "/dashboard/dealer/inventory", target: { selector: "a", text: "Add Vehicle" }, description: "Add Vehicle opens the listing wizard for auction or retail. Supply truthful details and your own photographs, complete the required declarations, and review before submitting. Drafts let you return later." },
        { id: "customers", title: "Customer enquiries", href: "/dashboard/dealer/crm", target: { selector: "button", text: "Add Customer" }, description: "Listing enquiries and offers appear automatically and stay linked to their vehicle. Add Customer is for walk-ins, phone calls and other enquiries you record yourself. Track follow-up and the customer’s stage here." },
        { id: "own-auctions", title: "Your auctions", href: "/dashboard/dealer/auctions", target: heading, description: "My Auctions tracks auctions for your own stock, including schedules, bids and outcomes. Review results and the required handover steps after a sale." },
        { id: "live", title: "Live dealer auctions", href: "/auctions/browse", target: heading, description: "Verified dealers can browse and bid on live auctions. Review the listing, minimum next bid and closing time before bidding. The winning dealer pays the £125 buyer fee; vehicle funds are paid directly to the seller." },
        { id: "bids", title: "Your auction bids", href: "/dashboard/dealer/bids?tab=auction", target: { selector: "a", text: "Auction bids" }, description: "Track your position in live auctions here. The page shows whether you are leading and any actions currently available. A provisional offer still needs the seller’s decision." },
        { id: "offers", title: "Your retail offers", href: "/dashboard/dealer/bids?tab=retail", target: { selector: "a", text: "Retail offers" }, description: "Switch to Retail offers to review offers you have made. Current, History and All separate offers you can still manage from previous outcomes." },
        { id: "received", title: "Offers on your stock", href: "/dashboard/dealer/offers", target: heading, description: "Offers received are from buyers interested in your listings. Review the vehicle, amount and available response options carefully before making a decision." },
        { id: "saved", title: "Saved vehicles", href: "/dashboard/dealer/wishlist", target: { selector: "nav[aria-label='Saved cars']" }, description: "Your shortlist has separate Auctions and Retail cars views. Check the current availability when you return to a saved vehicle; saving it does not reserve or buy it." },
        { id: "purchases", title: "Purchases and handovers", href: "/dashboard/dealer/purchases", target: { selector: "nav[aria-label='Purchase stages']" }, description: "Use In progress, Completed and Cancelled, with Auction and Retail filters. Open a purchase for its vehicle record, seller information, fees and handover details. Confirm collection only when it has actually happened." },
        { id: "messages", title: "Messages", href: "/dashboard/dealer/messages", target: heading, description: "Keep buyer and seller conversations in the relevant vehicle thread. Check the vehicle and participant before replying. Use support or reporting controls when you need help." },
        { id: "team", title: "Your dealership team", href: "/dashboard/dealer/team", target: heading, description: "Manage authorised staff and their permissions here. Only give each team member the access they need. This tour does not invite anyone or change permissions." },
        { id: "finance-calculator", title: "Platform finance calculator", href: "/dashboard/dealer/finance", target: { selector: "button[role=\"switch\"][aria-label=\"Show finance calculator on my listings\"]" }, description: "Choose whether the platform finance calculator appears on your retail listings. Buyers apply with the provider selected by CarMazium admin. This is separate from your own finance badge, and does not register you as a platform finance provider." },
        { id: "analytics", title: "Dealership performance", href: "/dashboard/dealer/analytics", target: heading, description: "Review your dealership’s recorded activity and performance. Use the reporting period controls to compare the dates you need; figures describe recorded activity for the selected period." },
        { id: "earnings", title: "Sales and earnings", href: "/dashboard/dealer/earnings", target: heading, description: "Review recorded sales, eligible incentives and payment status. A displayed vehicle price does not mean CarMazium has received or paid out the vehicle funds." },
    )
    else if (!contractor && !specialist) steps.push(
        { id: "cars", title: "Your vehicle listings", href: "/dashboard/user?tab=cars", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "My cars contains your listings and drafts. Check their status, continue unfinished listings and follow review feedback. Submitting an auction does not bypass approval, and retail listings still require the selected listing payment." },
        { id: "received", title: "Offers you receive", href: "/dashboard/user?tab=offers", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "Review buyers’ offers on your vehicles. Check the amount and any counter-offer before choosing a response. An offer is separate from confirmation that you have received the vehicle funds." },
        { id: "earnings", title: "Sales and earnings", href: "/dashboard/user?tab=earnings", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "Track your sales and eligible seller incentives. Complete payout details and the required handover process for an approved incentive. Vehicle buyers pay you directly." },
        { id: "stats", title: "Listing performance", href: "/dashboard/user?tab=stats", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "See recorded activity on your listings and use the reporting controls to review their performance." },
        { id: "offers", title: "Offers you make", href: "/dashboard/user?tab=bids", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "Track retail offers you have made and the seller’s response. Dealer-auction bidding is restricted to verified dealer accounts." },
        { id: "saved", title: "Saved cars", href: "/dashboard/user?tab=watchlist", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "Return to vehicles you have saved and check their current availability. Saving a vehicle does not reserve it or create a purchase." },
        { id: "purchases", title: "Your purchases", href: "/dashboard/user?tab=purchases", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "Review vehicles you have agreed to buy and follow the collection process. Inspect the vehicle and confirm the agreed arrangements directly with the seller." },
        { id: "messages", title: "Your messages", href: "/dashboard/user?tab=messages", target: { selector: "[data-tour='personal-dashboard-content'] h1, [data-tour='personal-dashboard-content'] h2, [data-tour='personal-dashboard-content'] h3" }, description: "Keep conversations with buyers and sellers linked to the relevant vehicle. Review the listing and participant before sending a message." },
        { id: "warranties", title: "Warranty purchases", href: "/dashboard/warranties", target: heading, description: "Review warranty applications and purchases here. Read the actual cover, eligibility, limits and terms before purchasing a warranty; a seller’s warranty badge is a separate invitation to ask that seller for details." },
        { id: "service-jobs", title: "Delivery and inspection jobs", href: "/services/jobs", target: heading, description: "Track service jobs you request, quotes and their status. Review the provider, scope and price before booking or paying. This tour does not post a job or accept a quote." },
        { id: "cancellations", title: "Sale cancellations", href: "/dashboard/cancellations", target: heading, description: "Review cancellation requests and their status here. Follow the displayed response and admin review process; a request alone does not mean the sale is cancelled." },
    )
    if (dealer || contractor) steps.push(
        { id: "partner", title: "Partner services", href: "/dashboard/partner", target: heading, description: "The Partner dashboard is for your delivery, recovery and inspection activity. Dealership finance and warranty badges describe what you offer on your own listings; they do not make you a platform-wide provider." },
        { id: "capabilities", title: "Service setup and approval", href: "/dashboard/service/capabilities", target: heading, description: "Complete business verification, verified payouts and the declaration. Collection, delivery and recovery need trade insurance. Inspection requires no inspection documents. Your original £1 dealer verification is not charged again for services." },
        { id: "jobs", title: "Available service jobs", href: "/dashboard/service/jobs", target: heading, description: "Review jobs available to your approved services and submit quotes only when eligible. Enabling a service preference does not approve an application or bypass insurance and payout checks." },
    )
    const settings: Array<[string, string, string]> = [
        ["personal", "Personal details", "Keep your name, contact information and location up to date. Review your changes before saving."],
        ...(dealer || contractor ? [["business", dealer && profile.dealerProfile ? "My dealership services" : "Partner Business Profile", "Manage your business profile and four service switches here. Finance and warranty badges appear only on your listings. Turn off services you do not offer. The platform finance calculator is a separate option."] as [string, string, string]] : []),
        ...(dealer || contractor ? [["verification", "Business verification", "Review your verification status and legal business type. Approved details may require review again if you change them, but your original £1 account verification is not charged again."] as [string, string, string]] : []),
        ["notifications", "Notifications & privacy", "Choose the supported sale-email and public-profile preferences here. Essential transaction messages still apply. Use Save preferences to save your choices."],
        ...(!specialist ? [["payouts", "Payouts & bank account", "Check your payout connection and bank information here. Vehicle buyers pay sellers directly. Service-job payouts require a verified payout account."] as [string, string, string]] : []),
        ["appearance", "Appearance", "Choose light or dark mode. Use the theme control to choose the display you find easiest to read."],
        ["security", "Password & account security", "Manage your password here. Account deletion is permanent and should only be used when you intend to close the account. The tour does not change security settings."],
        ["reviews", "Ratings & Reviews", "Review feedback received and reviews you have given. Your public profile lets other people see the information and badges available to them."],
        ["account", "Account Type", "Review the account options that apply to you. Changing account type can affect the features available, so read the information before choosing."],
    ]
    for (const [section, title, description] of settings) steps.push({ id: `settings-${section}`, title, description, href: `/profile?section=${section}`, target: { selector: "main h2, main h3", text: title } })
    steps.push({ id: "finish", title: "You’re ready to explore", href: "/profile?section=personal", target: { selector: "button", text: "Replay website introduction" }, description: "You can replay this walkthrough from Account Settings whenever you need it. Use the account menu to return to your dashboard and Contact Support when you need help." })
    return steps
}
