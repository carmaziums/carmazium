"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard,
    Car,
    DollarSign,
    Settings,
    LogOut,
    MessageSquare,
    Heart,
    Clock,
    Gavel,
    BarChart3,
    Briefcase,
    Menu,
    X
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface SidebarProps {
    role: "buyer" | "seller" | "provider"
    userName?: string
    userType?: string
    children?: React.ReactNode
}

export function DashboardSidebar({ role, userName: initialUserName, userType: initialUserType, children }: SidebarProps) {
    const pathname = usePathname()
    const { profile, user, signOut } = useAuth()
    const router = useRouter()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

    const handleSignOut = async (e: React.MouseEvent) => {
        e.preventDefault()
        await signOut()
        router.push('/')
    }

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

    // Resolve user name dynamically
    const userName = (initialUserName && initialUserName !== "John Doe" && initialUserName !== "Apex Customs" && initialUserName !== "User")
        ? initialUserName
        : (profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User"))

    const displayType = initialUserType || profile?.role || (role.charAt(0).toUpperCase() + role.slice(1)) + " Account"

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
        <>
            {/* Mobile Menu Button */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50">
                <button
                    onClick={toggleMobileMenu}
                    className="p-4 bg-primary text-white rounded-full shadow-lg"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                w-72 shrink-0 
                fixed lg:relative top-0 left-0 h-screen lg:h-auto
                z-40 lg:z-auto
                transition-transform duration-300 lg:translate-x-0
                ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
            `}>
                <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-5 lg:sticky lg:top-24">
                    {/* User Profile */}
                    <div className="flex items-center gap-3 mb-6 p-3 bg-slate-700/30 rounded-xl">
                        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold text-lg border border-primary/30">
                            {(userName || "U").split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-white truncate text-sm">{userName}</h3>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{displayType}</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="space-y-1">
                        {currentLinks.map((link) => {
                            const isActive = pathname === link.href
                            const Icon = link.icon
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${isActive
                                        ? "bg-primary text-white font-semibold"
                                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                                        }`}
                                >
                                    <Icon size={18} />
                                    {link.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Children (e.g., Create Listing button) */}
                    {children && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            {children}
                        </div>
                    )}

                    {/* Sign Out */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-sm"
                        >
                            <LogOut size={18} /> Sign Out
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
