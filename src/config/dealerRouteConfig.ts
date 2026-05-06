import {
    LayoutDashboard,
    Car,
    Kanban,
    Tag,
    DollarSign,
    MessageSquare,
    BarChart3,
    Users,
    Settings,
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
        label: "Overview", 
        title: "Overview",
        subHeader: "Welcome back",
        icon: LayoutDashboard 
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
        icon: BarChart3,
        hidden: true
    },
    { 
        href: "/dashboard/dealer/team", 
        label: "Team", 
        title: "Team",
        subHeader: "Manage dealership personnel & access protocols",
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
        subHeader: "Manage your dealership profile and preferences",
        icon: Settings 
    }
]
