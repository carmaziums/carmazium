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
    X,
    ChevronRight
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"

interface SidebarProps {
    role: "buyer" | "seller" | "provider"
    userName?: string
    userType?: string
    children?: React.ReactNode
}

export function DashboardSidebar({ role, userName: initialUserName, userType: initialUserType, children }: SidebarProps) {
    const pathname = usePathname()
    const { profile, user, signOut } = useAuth()
    const { unreadCount } = useChat()
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
            { href: "/dashboard/buyer/messages", label: "Messages", icon: MessageSquare, badge: unreadCount },
            { href: "/dashboard/buyer/history", label: "History", icon: Clock },
            { href: "/dashboard/buyer/settings", label: "Settings", icon: Settings },
        ],
        seller: [
            { href: "/dashboard/seller", label: "Overview", icon: LayoutDashboard },
            { href: "/dashboard/seller/listings", label: "Listings", icon: Car },
            { href: "/dashboard/seller/performance", label: "Stats", icon: BarChart3 },
            { href: "/dashboard/seller/messages", label: "Messages", icon: MessageSquare, badge: unreadCount },
            { href: "/dashboard/seller/earnings", label: "Earnings", icon: DollarSign },
            { href: "/dashboard/seller/settings", label: "Settings", icon: Settings },
        ],
        provider: [
            { href: "/dashboard/service", label: "Overview", icon: LayoutDashboard },
            { href: "/dashboard/service/jobs", label: "Jobs", icon: Briefcase },
            { href: "/dashboard/service/messages", label: "Messages", icon: MessageSquare, badge: unreadCount },
            { href: "/dashboard/service/settings", label: "Settings", icon: Settings },
        ]
    }

    const currentLinks = links[role] || []
    // Get first 5 items for mobile bottom nav
    const mobileLinks = currentLinks.slice(0, 5)

    return (
        <>
            {/* Mobile Bottom Tab Navigation */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 safe-area-pb">
                <div className="flex justify-around items-center py-2 px-1">
                    {mobileLinks.map((link) => {
                        const isActive = pathname === link.href
                        const Icon = link.icon
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg min-w-[60px] relative transition-all ${isActive
                                        ? "text-primary"
                                        : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                <div className="relative">
                                    <Icon size={20} />
                                    {link.badge && link.badge > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                            {link.badge > 9 ? '9+' : link.badge}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-primary' : ''}`}>
                                    {link.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                                )}
                            </Link>
                        )
                    })}
                    {/* More menu trigger for additional items */}
                    <button
                        onClick={toggleMobileMenu}
                        className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg min-w-[60px] transition-all ${isMobileMenuOpen ? "text-primary" : "text-gray-400 hover:text-white"
                            }`}
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        <span className="text-[10px] mt-1 font-medium">More</span>
                    </button>
                </div>
            </div>

            {/* Mobile Full Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Full Menu Panel */}
            <div className={`
                lg:hidden fixed bottom-16 left-0 right-0 z-40
                bg-slate-900 border-t border-white/10 rounded-t-2xl
                transition-transform duration-300 ease-out
                ${isMobileMenuOpen ? "translate-y-0" : "translate-y-full"}
            `}>
                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                    {/* User Profile */}
                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl mb-4">
                        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold text-sm border border-primary/30">
                            {(userName || "U").split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">{userName}</h3>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{displayType}</p>
                        </div>
                    </div>

                    {/* All Links */}
                    {currentLinks.map((link) => {
                        const isActive = pathname === link.href
                        const Icon = link.icon
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                        ? "bg-primary text-white"
                                        : "text-gray-300 hover:bg-white/5"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={18} />
                                    <span className="text-sm font-medium">{link.label}</span>
                                    {link.badge && link.badge > 0 && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-primary/20 text-primary'
                                            }`}>
                                            {link.badge}
                                        </span>
                                    )}
                                </div>
                                <ChevronRight size={16} className="opacity-40" />
                            </Link>
                        )
                    })}

                    {/* Children */}
                    {children && <div className="pt-2">{children}</div>}

                    {/* Sign Out */}
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </div>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-72 shrink-0">
                <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sticky top-24">
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
                                    className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${isActive
                                        ? "bg-primary text-white font-semibold"
                                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} />
                                        {link.label}
                                    </div>
                                    {link.badge && link.badge > 0 && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-primary/20 text-primary'
                                            }`}>
                                            {link.badge}
                                        </span>
                                    )}
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

            {/* Bottom spacing for mobile to account for nav bar */}
            <div className="h-20 lg:hidden" />
        </>
    )
}
