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
    Receipt,
    Wrench,
    ShieldCheck,
    ShoppingBag,
    History,
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
    /**
     * Other dealer pages that belong to this menu item. While the dealer is on
     * one of them, this item stays highlighted so they never lose their place.
     */
    activePrefixes?: string[]
}

/**
 * Keep the persistent dealer navigation intentionally small.
 * Routes marked `hidden` are NOT removed: they are listed in the sidebar's
 * collapsible "More tools" group (desktop) and in the mobile More panel, so
 * every dealer tool stays reachable from the menu without crowding it.
 */
export const DEALER_ROUTE_CONFIG: DealerRoute[] = [
    {
        href: "/dashboard/dealer",
        label: "Home",
        title: "Dealer Command Centre",
        subHeader: "Run your dealership from one place",
        icon: LayoutDashboard,
        section: "Dashboard"
    },
    {
        href: "/dashboard/dealer/inventory",
        requiredPermission: "VIEW_INVENTORY",
        label: "Stock",
        title: "Stock",
        subHeader: "Manage live, draft and sold stock",
        icon: Car,
        section: "Sell",
        activePrefixes: ["/dashboard/dealer/add-listing", "/dashboard/dealer/put-on-auction"]
    },
    {
        href: "/dashboard/dealer/crm",
        requiredPermission: "MANAGE_CRM",
        label: "Customers",
        title: "Customers",
        subHeader: "Enquiries, offers and buyer follow-up",
        icon: Kanban,
        section: "Sell",
        activePrefixes: ["/dashboard/dealer/offers"]
    },
    {
        href: "/dashboard/dealer/offers",
        requiredPermission: "MANAGE_OFFERS",
        label: "Offers",
        title: "Offers Received",
        subHeader: "Review offers buyers made on your vehicles",
        icon: Tag,
        hidden: true,
        section: "Sell"
    },
    {
        href: "/dashboard/dealer/auctions",
        requiredPermission: "VIEW_TRADE",
        label: "Buy & Bid",
        title: "Auctions & Buying",
        subHeader: "Live auctions, bids and purchases",
        icon: Gavel,
        section: "Buy",
        activePrefixes: ["/dashboard/dealer/auctions", "/dashboard/dealer/bids"]
    },
    {
        href: "/dashboard/dealer/purchases",
        requiredPermission: "VIEW_PURCHASES",
        label: "Purchases",
        title: "All Purchases",
        subHeader: "Every vehicle you have bought or agreed to buy, retail and auction",
        icon: ShoppingBag,
        section: "Buy",
        // Purchase History and each purchase record sit under this item.
        activePrefixes: ["/dashboard/dealer/purchases"]
    },
    {
        href: "/dashboard/dealer/purchases/retail",
        requiredPermission: "VIEW_PURCHASES",
        label: "Retail Purchases",
        title: "Retail Purchases",
        subHeader: "Accepted retail offers and recorded retail purchases",
        icon: ShoppingBag,
        hidden: true,
        section: "Buy"
    },
    {
        href: "/dashboard/dealer/purchases/history",
        requiredPermission: "VIEW_PURCHASES",
        label: "Purchase History",
        title: "Purchase History",
        subHeader: "Completed purchases and cancelled sales",
        icon: History,
        hidden: true,
        section: "Buy"
    },
    {
        href: "/dashboard/dealer/auctions/won",
        requiredPermission: "VIEW_PURCHASES",
        label: "Purchases",
        title: "Auction Wins",
        subHeader: "Auction wins and next handover steps",
        icon: Trophy,
        hidden: true,
        section: "Buy"
    },
    {
        href: "/dashboard/cancellations",
        label: "Cancelled Sales",
        title: "Sale Cancellations",
        subHeader: "Review buyer and seller cancellation requests",
        icon: ShieldCheck,
        section: "Buy",
        hidden: true
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
        href: "/profile?section=business",
        label: "Account Settings",
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
        section: "Buy"
    },
    {
        href: "/dashboard/dealer/bids",
        requiredPermission: "VIEW_TRADE",
        label: "Bids & offers",
        title: "Bids & offers",
        subHeader: "Auctions you are currently bidding on",
        icon: Gavel,
        hidden: true,
        section: "Buy"
    },
    {
        href: "/dashboard/dealer/wishlist",
        label: "Saved Cars",
        title: "Saved Cars",
        subHeader: "Vehicles saved for later",
        icon: Heart,
        hidden: true,
        section: "Buy"
    },
    {
        href: "/dashboard/dealer/finance",
        label: "Finance Applications",
        title: "Finance Applications",
        subHeader: "Track customer finance applications",
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
        section: "Business"
    },
    {
        href: "/dashboard/dealer/earnings",
        requiredPermission: "VIEW_ANALYTICS",
        label: "Earnings",
        title: "Revenue & Earnings",
        subHeader: "Revenue and platform sales history",
        icon: Receipt,
        hidden: true,
        section: "Business"
    }
]

/**
 * Menu groups, in display order. The website sidebar and the CarMazium app
 * drawer use the same groups and order (checked by check-product-parity.mjs):
 * Sell, then Buy, then Business, then Services. Each group heading appears
 * once; less-used tools sit inside their group under "More tools".
 */
export const DEALER_SECTION_ORDER = ["Dashboard", "Sell", "Buy", "Business", "Services"] as const

/** Stable sort of menu entries into DEALER_SECTION_ORDER. */
export function sortBySection<T extends { section?: string }>(items: T[]): T[] {
    const rank = (section?: string) => {
        const i = DEALER_SECTION_ORDER.indexOf(section as (typeof DEALER_SECTION_ORDER)[number])
        return i === -1 ? DEALER_SECTION_ORDER.length : i
    }
    return items.map((item, i) => ({ item, i }))
        .sort((a, b) => rank(a.item.section) - rank(b.item.section) || a.i - b.i)
        .map(({ item }) => item)
}

/** The dealer menu item that owns `pathname` (exact match first, then its related pages). */
export function dealerRouteIsActive(route: Pick<DealerRoute, "href" | "activePrefixes">, pathname: string): boolean {
    const path = route.href.split("?")[0]
    if (pathname === path) return true
    return (route.activePrefixes ?? []).some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Look a dealer route up by its address. Prefer this to DEALER_ROUTE_CONFIG[n]:
 * positional lookups drift when the list changes (the Messages and Finance
 * pages were showing the titles of the Cancellations and Auction Wins routes).
 */
export function getDealerRoute(href: string): DealerRoute {
    const route = DEALER_ROUTE_CONFIG.find(r => r.href === href)
    if (!route) throw new Error(`Unknown dealer route: ${href}`)
    return route
}
