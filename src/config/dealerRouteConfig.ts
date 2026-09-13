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
}

export const DEALER_ROUTE_CONFIG: DealerRoute[] = [
    {
        href: "/dashboard/dealer",
        label: "Vehicle Dealer",
        title: "Vehicle Dealer",
        subHeader: "Dealer workspace",
        icon: Car
    },
    {
        href: "/dashboard/partner",
        label: "Partner Home",
        title: "Partner Dashboard",
        subHeader: "Manage your business add-ons",
        icon: LayoutDashboard
    },
    {
        href: "/dashboard/service/capabilities",
        label: "Service Add-ons",
        title: "Service Add-ons",
        subHeader: "Delivery, recovery and inspection services",
        icon: Wrench
    },
    {
        href: "/dashboard/service/jobs",
        label: "Service Jobs",
        title: "Service Jobs",
        subHeader: "TradeXchange work for your business",
        icon: Briefcase
    },
    {
        href: "/dashboard/dealer/inventory",
        label: "Inventory",
        title: "Inventory",
        subHeader: "Curate and manage your high-end stock",
        icon: Car
    },
    {
        href: "/dashboard/dealer/crm",
        label: "Leads",
        title: "Leads",
        subHeader: "Strategic lead management & conversion tracking",
        icon: Kanban
    },
    {
        href: "/dashboard/dealer/offers",
        label: "Offers",
        title: "Offers",
        subHeader: "Direct high-value vehicle acquisition review",
        icon: Tag
    },
    {
        href: "/dashboard/dealer/my-offers",
        label: "My Offers",
        title: "My Offers",
        subHeader: "Outgoing bids placed on other dealers' inventory",
        icon: Gavel
    },
    {
        href: "/dashboard/dealer/finance",
        label: "Finance",
        title: "Finance",
        subHeader: "Strategic vehicle financing & liquidity oversight",
        icon: DollarSign
    },
    {
        href: "/dashboard/dealer/messages",
        label: "Messages",
        title: "Messages",
        subHeader: "Direct bespoke communication",
        icon: MessageSquare
    },
    {
        href: "/dashboard/dealer/analytics",
        label: "Analytics",
        title: "Analytics",
        subHeader: "Strategic market performance & predictive insights",
        icon: BarChart3
    },
    {
        href: "/dashboard/dealer/team",
        label: "Team",
        title: "Team",
        subHeader: "Manage business personnel & service permissions",
        icon: Users
    },
    {
        href: "/dashboard/dealer/earnings",
        label: "Earnings",
        title: "Revenue & Earnings",
        subHeader: "Strategic revenue tracking and platform sales history",
        icon: DollarSign
    },
    {
        href: "/dashboard/dealer/settings",
        label: "Settings",
        title: "Settings",
        subHeader: "Manage your business profile and preferences",
        icon: Settings
    },
    {
        href: "/dashboard/dealer/auctions",
        label: "Auctions",
        title: "Auctions",
        subHeader: "Manage live vehicle auctions & bidding",
        icon: Gavel
    },
    {
        href: "/dashboard/dealer/auctions/won",
        label: "Purchased from Auction",
        title: "Purchased from Auction",
        subHeader: "Every auction you're bidding on or have won, and exactly what to do next",
        icon: Trophy
    },
    {
        href: "/dashboard/dealer/wishlist",
        label: "Wishlist",
        title: "Wishlist",
        subHeader: "Vehicles you're tracking across the marketplace",
        icon: Heart
    }
]
