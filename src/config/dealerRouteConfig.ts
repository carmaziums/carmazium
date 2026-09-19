import {
    LayoutDashboard,
    Car,
    Kanban,
    Tag,
    Gavel,
    DollarSign,
    MessageSquare,
    BarChart3,
    Users,
    Settings,
    Heart,
    Trophy,
    Briefcase,
    Wrench,
    LucideIcon
} from "lucide-react"

export interface DealerRoute {
    href: string
    label: string
    title: string
    subHeader: string
    icon: LucideIcon
    hidden?: boolean
    section?: string
}

export const DEALER_ROUTE_CONFIG: DealerRoute[] = [
    {
        href: "/dashboard/dealer",
        label: "Dealer Home",
        title: "Vehicle Dealer",
        subHeader: "Dealer workspace",
        icon: Car,
        section: "Workspaces"
    },
    {
        href: "/dashboard/partner",
        label: "Partner Home",
        title: "Partner Dashboard",
        subHeader: "Manage your business add-ons",
        icon: LayoutDashboard,
        section: "Workspaces"
    },
    {
        href: "/dashboard/service/capabilities",
        label: "Service Add-ons",
        title: "Service Add-ons",
        subHeader: "Delivery, inspection, finance and warranty services",
        icon: Wrench,
        section: "Workspaces"
    },
    {
        href: "/dashboard/service/jobs",
        label: "Service Jobs",
        title: "Service Jobs",
        subHeader: "TradeXchange work for your business",
        icon: Briefcase,
        section: "Workspaces"
    },
    {
        href: "/dashboard/service/leads",
        label: "Service Enquiries",
        title: "Finance & Warranty Enquiries",
        subHeader: "Matched TradeXchange customer enquiries",
        icon: Briefcase,
        section: "Workspaces"
    },
    {
        href: "/dashboard/dealer/inventory",
        label: "Inventory",
        title: "Inventory",
        subHeader: "Curate and manage your high-end stock",
        icon: Car,
        section: "Sales"
    },
    {
        href: "/dashboard/dealer/crm",
        label: "Leads",
        title: "Leads",
        subHeader: "Strategic lead management & conversion tracking",
        icon: Kanban,
        section: "Sales"
    },
    {
        href: "/dashboard/dealer/offers",
        label: "Offers Received",
        title: "Offers",
        subHeader: "Direct high-value vehicle acquisition review",
        icon: Tag,
        section: "Sales"
    },
    {
        href: "/dashboard/dealer/my-offers",
        label: "My Offers",
        title: "My Offers",
        subHeader: "Retail offers you've made on marketplace vehicles",
        icon: Gavel,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/bids",
        label: "My Auction Bids",
        title: "My Auction Bids",
        subHeader: "Live auctions you're currently bidding on",
        icon: Gavel,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/auctions",
        label: "Auctions",
        title: "Auctions",
        subHeader: "Manage live vehicle auctions & bidding",
        icon: Gavel,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/auctions/won",
        label: "Auction Purchases",
        title: "Purchased from Auction",
        subHeader: "Every auction you're bidding on or have won, and exactly what to do next",
        icon: Trophy,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/wishlist",
        label: "Saved Cars",
        title: "Saved Cars",
        subHeader: "Vehicles you've saved to review and make offers on",
        icon: Heart,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/messages",
        label: "Messages",
        title: "Messages",
        subHeader: "Direct bespoke communication",
        icon: MessageSquare,
        section: "Business"
    },
    {
        href: "/dashboard/dealer/team",
        label: "Team",
        title: "Team",
        subHeader: "Manage business personnel & service permissions",
        icon: Users,
        section: "Business"
    },
    {
        href: "/dashboard/dealer/finance",
        label: "Finance",
        title: "Finance",
        subHeader: "Strategic vehicle financing & liquidity oversight",
        icon: DollarSign,
        section: "Business"
    },
    {
        href: "/dashboard/dealer/analytics",
        label: "Analytics",
        title: "Analytics",
        subHeader: "Strategic market performance & predictive insights",
        icon: BarChart3,
        section: "Performance"
    },
    {
        href: "/dashboard/dealer/earnings",
        label: "Earnings",
        title: "Revenue & Earnings",
        subHeader: "Strategic revenue tracking and platform sales history",
        icon: DollarSign,
        section: "Performance"
    },
    {
        href: "/dashboard/dealer/settings",
        label: "Settings",
        title: "Settings",
        subHeader: "Manage your business profile and preferences",
        icon: Settings,
        section: "Account"
    }
]
