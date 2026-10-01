export interface AccountOnboardingGuide {
    accountLabel: string;
    greeting: (name: string) => string;
    tagline: string;
    features: string[];
    nextStep: string;
    notificationTitle: string;
    notificationMessage: string;
    dashboardPath: string;
}

const PERSONAL_FEATURES = [
    'Browse and buy retail vehicles from your Personal Account',
    'Sell by dealer auction with a free auction listing — verified motor traders place the bids',
    'Sell by retail listing for £1 until the vehicle is sold',
    'Manage listings, offers, messages and account activity from one dashboard',
    'Personal Accounts can buy retail vehicles but do not bid in dealer auctions',
];

const GUIDES: Record<string, AccountOnboardingGuide> = {
    BUYER: {
        accountLabel: 'Personal Account',
        greeting: (name) => `Welcome to CarMazium, ${name}!`,
        tagline: 'One account for buying retail vehicles and selling your own vehicle.',
        features: PERSONAL_FEATURES,
        nextStep: 'Complete your account details, then use your dashboard to buy or start a vehicle sale.',
        notificationTitle: 'Welcome to CarMazium — Start Here',
        notificationMessage: 'Your Personal Account can buy retail vehicles and sell by free dealer auction or £1 retail listing. Open this guide to see how your account works.',
        dashboardPath: '/dashboard',
    },
    SELLER: {
        accountLabel: 'Personal Account',
        greeting: (name) => `Welcome to CarMazium, ${name}!`,
        tagline: 'Your Personal Account can both sell vehicles and buy retail vehicles.',
        features: PERSONAL_FEATURES,
        nextStep: 'Complete your account details, then start a valuation or create your vehicle listing.',
        notificationTitle: 'Welcome to CarMazium — Start Here',
        notificationMessage: 'Your Personal Account can sell by free dealer auction or £1 retail listing and can also buy retail vehicles. Open this guide to get started.',
        dashboardPath: '/dashboard',
    },
    DEALER: {
        accountLabel: 'Partner Account',
        greeting: (name) => `Welcome to your CarMazium Partner Account, ${name}!`,
        tagline: 'Your business account brings vehicle trading and approved automotive services together.',
        features: [
            'Complete your business details and KYC verification before bidding in dealer auctions',
            'List auction stock for free or create a retail listing for £1 until sold',
            'Bid in dealer auctions once verified; a £125 CarMazium buyer fee applies to successful auction purchases',
            'Manage inventory, offers, purchases and team access from your Partner dashboard',
            'Add Delivery & Recovery, Vehicle Inspection, Finance and Warranty services where your business has the required approval',
        ],
        nextStep: 'Open your Partner dashboard and complete business/KYC verification so protected trade tools can be enabled.',
        notificationTitle: 'Your Partner Account is ready — Start Here',
        notificationMessage: 'Complete business/KYC verification, then use your Partner dashboard to trade vehicles, manage stock and add approved business services.',
        dashboardPath: '/dashboard/partner',
    },
    CONTRACTOR: {
        accountLabel: 'Service Partner Account',
        greeting: (name) => `Welcome to CarMazium, ${name}!`,
        tagline: 'Your account is set up for approved automotive service work.',
        features: [
            'Apply for the service capabilities your business provides',
            'Capability approval is required before protected service work becomes available',
            'Respond to suitable work requests and manage accepted jobs from your service dashboard',
            'Use CarMazium messaging for job communication once the relevant workflow allows it',
            'Keep your service activity and account details together in one place',
        ],
        nextStep: 'Open your service dashboard and complete the capability/application steps for the work you want to provide.',
        notificationTitle: 'Your Service Partner Account is ready — Start Here',
        notificationMessage: 'Open your getting-started guide to complete service capability approval and learn how jobs, offers and messaging work.',
        dashboardPath: '/dashboard/service',
    },
    FINANCE_PARTNER: {
        accountLabel: 'Finance Partner Account',
        greeting: (name) => `Welcome to CarMazium, ${name}!`,
        tagline: 'Your finance partner workspace is ready.',
        features: [
            'Review finance enquiries made through CarMazium',
            'Return finance quotes through the partner workflow',
            'Track enquiry progress from your finance dashboard',
            'Manage your partner account details and availability',
        ],
        nextStep: 'Open your finance dashboard to review your account setup and available enquiries.',
        notificationTitle: 'Your Finance Partner Account is ready — Start Here',
        notificationMessage: 'Open your getting-started guide to see how finance enquiries, quotes and partner account tools work.',
        dashboardPath: '/dashboard/finance',
    },
    INSURANCE_PARTNER: {
        accountLabel: 'Insurance Partner Account',
        greeting: (name) => `Welcome to CarMazium, ${name}!`,
        tagline: 'Your insurance partner workspace is ready.',
        features: [
            'Review insurance quote requests made through CarMazium',
            'Return quotes through the partner workflow',
            'Track requests and responses from your insurance dashboard',
            'Manage your partner account details and availability',
        ],
        nextStep: 'Open your insurance dashboard to review your account setup and available quote requests.',
        notificationTitle: 'Your Insurance Partner Account is ready — Start Here',
        notificationMessage: 'Open your getting-started guide to see how insurance quote requests and partner tools work.',
        dashboardPath: '/dashboard/insurance',
    },
};

const GENERIC_GUIDE: AccountOnboardingGuide = {
    accountLabel: 'CarMazium Account',
    greeting: (name) => `Welcome to CarMazium, ${name}!`,
    tagline: 'Your CarMazium account is ready.',
    features: [
        'Use the tools available to your account type from your dashboard',
        'Keep your profile and contact details up to date',
        'Use CarMazium messages and notifications to follow account activity',
    ],
    nextStep: 'Open your dashboard to continue.',
    notificationTitle: 'Welcome to CarMazium — Start Here',
    notificationMessage: 'Open your getting-started guide to see the tools available to your CarMazium account.',
    dashboardPath: '/dashboard',
};

export function getAccountOnboardingGuide(role?: string | null): AccountOnboardingGuide {
    const normalized = String(role || '').trim().toUpperCase();
    return GUIDES[normalized] || GENERIC_GUIDE;
}
