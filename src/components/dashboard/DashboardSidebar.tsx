"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Car, DollarSign, Settings, LogOut, PlusCircle, MessageSquare, Heart, Clock, Gavel, BarChart3, User, Briefcase } from "lucide-react"

interface SidebarProps {
    role: "buyer" | "seller" | "provider"
    userName?: string
    userType?: string
    children?: React.ReactNode
}

export function DashboardSidebar({ role, userName = "John Doe", userType, children }: SidebarProps) {
    const pathname = usePathname()

    const displayType = userType || (role.charAt(0).toUpperCase() + role.slice(1)) + " Account"

    const links = {
        buyer: [
            { href: "/dashboard/buyer", label: "Dashboard", icon: LayoutDashboard },
            { href: "/dashboard/buyer/bids", label: "My Bids", icon: Gavel },
            { href: "/dashboard/buyer/watchlist", label: "Watchlist", icon: Heart },
            { href: "/dashboard/buyer/messages", label: "Messages", icon: MessageSquare },
            { href: "/dashboard/buyer/history", label: "Order History", icon: Clock },
            { href: "/dashboard/buyer/settings", label: "Settings", icon: Settings },
        ],
        seller: [
            { href: "/dashboard/seller", label: "Overview", icon: LayoutDashboard },
            { href: "/dashboard/seller/listings", label: "My Listings", icon: Car },
            { href: "/dashboard/seller/performance", label: "Performance", icon: BarChart3 },
            { href: "/dashboard/seller/messages", label: "Messages", icon: MessageSquare },
            { href: "/dashboard/seller/earnings", label: "Earnings", icon: DollarSign },
            { href: "/dashboard/seller/settings", label: "Settings", icon: Settings },
        ],
        provider: [
            { href: "/dashboard/service", label: "Overview", icon: LayoutDashboard },
            { href: "/dashboard/service/jobs", label: "Active Jobs", icon: Briefcase },
            { href: "/dashboard/service/messages", label: "Messages", icon: MessageSquare },
            { href: "/dashboard/service/settings", label: "Settings", icon: Settings },
        ]
    }

    const currentLinks = links[role] || []

    return (
        <aside className="lg:w-1/4">
            <div className="glass-card p-6 sticky top-24 shadow-lg border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xl border border-primary/50 shadow-neon">
                        {userName.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white">{userName}</h3>
                        <p className="text-xs text-gray-400">{displayType}</p>
                    </div>
                </div>

                <nav className="space-y-2">
                    {currentLinks.map((link) => {
                        const isActive = pathname === link.href
                        const Icon = link.icon
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 group ${isActive
                                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(237,28,36,0.1)]"
                                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                <Icon size={20} className={isActive ? "text-primary" : "text-gray-400 group-hover:text-white transition-colors"} />
                                {link.label}
                            </Link>
                        )
                    })}

                    {children && (
                        <div className="pt-4 mt-2">
                            {children}
                        </div>
                    )}

                    <div className="pt-4 mt-4 border-t border-white/10">
                        <Link href="/auth/login" className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors group">
                            <LogOut size={20} className="group-hover:scale-110 transition-transform" /> Sign Out
                        </Link>
                    </div>
                </nav>
            </div>
        </aside>
    )
}
