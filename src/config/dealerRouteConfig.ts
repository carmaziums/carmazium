import type { DealerPermission } from "@/lib/dealerAccess"
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
    requiredPermission?: DealerPermission
}

/**
 * Keep the persistent dealer navigation intentionally small.
 * Secondary tools stay routable and are exposed from the Dealer Command
 * Centre in job-based groups, instead of forcing dealers through a 15–20
 * item sidebar / mobile More menu.
 */
export const DEALER_ROUTE_CONFIG: DealerRoute[] = [
    {
        href: "/dashboard/dealer",
        label: "Home",
        title: "Dealer Command Centre",
        subHeader: "Run your dealership from one place",
        icon: LayoutDashboard,
        section: "Main"
    },
    {
        href: "/dashboard/dealer/inventory",
        requiredPermission: "VIEW_INVENTORY",
        label: "Stock",
        title: "Inventory",
        subHeader: "Manage live, draft and sold stock",
        icon: Car,
        section: "Main"
    },
    {
        href: "/dashboard/dealer/crm",
        requiredPermission: "MANAGE_CRM",
        label: "Customers",
        title: "Customers",
        subHeader: "Enquiries, offers and buyer follow-up",
        icon: Kanban,
        section: "Main"
    },
    {
        href: "/dashboard/dealer/offers",
        requiredPermission: "MANAGE_OFFERS",
        label: "Offers",
        title: "Offers Received",
        subHeader: "Review offers on your vehicles",
        icon: Tag,
        hidden: true,
        section: "Main"
    },
    {
        href: "/dashboard/dealer/auctions",
        requiredPermission: "VIEW_TRADE",
        label: "Buy & Bid",
        title: "Auctions & Buying",
        subHeader: "Live auctions, bids and purchases",
        icon: Gavel,
        section: "Main"
    },
    {
        href: "/dashboard/dealer/auctions/won",
        requiredPermission: "VIEW_PURCHASES",
        label: "Purchases",
        title: "Purchased from Auction",
        subHeader: "Auction wins and next handover steps",
        icon: Trophy,
        hidden: true,
        section: "Business"
    },
    {
        href: "/dashboard/dealer/messages",
        label: "Messages",
        title: "Messages",
        subHeader: "Customer and support conversations",
        icon: MessageSquare,
        section: "Business"
    },
    {
        href: "/dashboard/dealer/team",
        requiredPermission: "MANAGE_TEAM",
        label: "Team",
        title: "Team",
        subHeader: "Manage staff and permissions",
        icon: Users,
        section: "Business"
    },
    {
        href: "/dashboard/dealer/settings",
        label: "Settings",
        title: "Settings",
        subHeader: "Business profile and preferences",
        icon: Settings,
        section: "Business"
    },

    {
        href: "/dashboard/partner",
        label: "Partner Account",
        title: "Partner Account",
        subHeader: "Business details, payouts and service status",
        icon: LayoutDashboard,
        hidden: true,
        section: "Services"
    },
    {
        href: "/dashboard/service/capabilities",
        label: "Service Add-ons",
        title: "Service Add-ons",
        subHeader: "Delivery, inspection, finance and warranty services",
        icon: Wrench,
        hidden: true,
        section: "Services"
    },
    {
        href: "/dashboard/service/jobs",
        label: "Service Jobs",
        title: "Service Jobs",
        subHeader: "TradeXchange delivery and inspection work",
        icon: Briefcase,
        hidden: true,
        section: "Services"
    },
    {
        href: "/dashboard/service/leads",
        label: "Service Enquiries",
        title: "Finance & Warranty Enquiries",
        subHeader: "Matched TradeXchange customer enquiries",
        icon: Briefcase,
        hidden: true,
        section: "Services"
    },
    {
        href: "/dashboard/dealer/my-offers",
        requiredPermission: "MANAGE_OFFERS",
        label: "My Retail Offers",
        title: "My Offers",
        subHeader: "Retail offers made on marketplace vehicles",
        icon: Tag,
        hidden: true,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/bids",
        requiredPermission: "VIEW_TRADE",
        label: "My Auction Bids",
        title: "My Auction Bids",
        subHeader: "Auctions you are currently bidding on",
        icon: Gavel,
        hidden: true,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/wishlist",
        label: "Saved Cars",
        title: "Saved Cars",
        subHeader: "Vehicles saved for later",
        icon: Heart,
        hidden: true,
        section: "Buying"
    },
    {
        href: "/dashboard/dealer/finance",
        label: "Finance",
        title: "Finance",
        subHeader: "Dealership finance tools",
        icon: DollarSign,
        hidden: true,
        section: "Business"
    },
    {
        href: "/dashboard/dealer/analytics",
        requiredPermission: "VIEW_ANALYTICS",
        label: "Analytics",
        title: "Analytics",
        subHeader: "Dealership performance and insights",
        icon: BarChart3,
        hidden: true,
        section: "Performance"
    },
    {
        href: "/dashboard/dealer/earnings",
        requiredPermission: "VIEW_ANALYTICS",
        label: "Earnings",
        title: "Revenue & Earnings",
        subHeader: "Revenue and platform sales history",
        icon: DollarSign,
        hidden: true,
        section: "Performance"
    }
]
