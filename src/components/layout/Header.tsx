"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, LogIn, User as UserIcon, LogOut, ChevronDown, Car, Gavel, ShieldCheck, Truck, Wrench, Banknote, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { getPendingOffersCount } from "@/lib/listingApi"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { ThemeToggle } from "@/components/ui/ThemeToggle"


type NavLink =
    | { name: string; href: string; prefetch?: boolean; badge?: string; kind?: undefined }
    | { name: "Buy Cars"; kind: "buy-menu"; href?: undefined; prefetch?: undefined; badge?: undefined }
    | { name: "Sell Cars"; kind: "sell-menu"; href?: undefined; prefetch?: undefined; badge?: undefined }
    | { name: "TradeXchange"; kind: "trade-menu"; href?: undefined; prefetch?: undefined; badge?: undefined }

const navLinks: NavLink[] = [
    { name: "Home", href: "/" },
    { name: "Buy Cars", kind: "buy-menu" },
    { name: "Sell Cars", kind: "sell-menu" },
    // TradeXchange keeps /auctions as its overview route for backwards
    // compatibility, while the header exposes each current service area.
    { name: "TradeXchange", kind: "trade-menu" },
    { name: "Compare", href: "/compare" },
    { name: "Pricing", href: "/pricing" },
    { name: "About", href: "/about" },
]

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false)
    const [isBuyMenuOpen, setIsBuyMenuOpen] = React.useState(false)
    const [isSellMenuOpen, setIsSellMenuOpen] = React.useState(false)
    const [isTradeMenuOpen, setIsTradeMenuOpen] = React.useState(false)
    const [activeLink, setActiveLink] = React.useState("")

    const pathname = usePathname()
    const router = useRouter()
    const { user, profile, loading, signOut } = useAuth()
    const { unreadCount } = useChat()

    React.useEffect(() => {
        setActiveLink(pathname || "")
        setIsBuyMenuOpen(false)
        setIsSellMenuOpen(false)
        setIsTradeMenuOpen(false)
        setIsMobileMenuOpen(false)
    }, [pathname])

    const buyCarsActive =
        activeLink === "/search"
        || activeLink.startsWith("/buy-cars")
        || activeLink === "/auctions/browse"
        || activeLink.startsWith("/auctions/live/")

    const sellCarsActive = activeLink === "/sell"

    const tradeXchangeActive =
        activeLink === "/auctions"
        || activeLink === "/auctions/how-it-works"
        || activeLink.startsWith("/services")

    // Every account sees the TradeXchange link, dealer or not. Hiding it from
    // buyers and sellers hid the upsell as well as the room: a retail account is
    // exactly who we want to convert into a dealer, and they can't want what they
    // can't see. Non-dealers who follow it land on the upgrade prompt in
    // RequireAuth — no trade stock and no live bids reach them, so the link costs
    // nothing but a click.
    const visibleNavLinks = navLinks

    const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

    const handleSignOut = async () => {
        await signOut()
        setIsUserMenuOpen(false)
        router.push('/')
    }



    return (
        <header className="fixed top-0 left-0 w-full z-[60] border-b shadow-2xl transition-all duration-300"
            style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
            }}
        >
            <div 
                className="absolute inset-0 -z-10 backdrop-blur-xl"
                style={{ 
                    background: 'var(--bg-header)',
                    WebkitTransform: 'translate3d(0,0,0)',
                    transform: 'translate3d(0,0,0)' 
                }} 
            />
            <div className="container mx-auto px-6 flex items-center justify-between gap-6 h-20 relative z-10">

                {/* Logo Area */}
                <div className="flex-1 flex items-center justify-start gap-6">
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/assets/images/logo-light.png"
                            alt="CarMazium"
                            width={160}
                            height={40}
                            sizes="160px"
                            className="h-9 md:h-10 w-auto object-contain dark:hidden"
                            priority
                        />
                        <Image
                            src="/assets/images/logo.png"
                            alt="CarMazium"
                            width={160}
                            height={40}
                            sizes="160px"
                            className="h-9 md:h-10 w-auto object-contain hidden dark:block"
                            priority
                        />
                    </Link>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden lg:flex flex-none justify-center gap-8">
                    {visibleNavLinks.map((link) => {
                        if (link.kind === "buy-menu") {
                            return (
                                <div
                                    key={link.name}
                                    className="relative"
                                    onMouseEnter={() => setIsBuyMenuOpen(true)}
                                    onMouseLeave={() => setIsBuyMenuOpen(false)}
                                >
                                    <button
                                        type="button"
                                        aria-expanded={isBuyMenuOpen}
                                        aria-haspopup="menu"
                                        onClick={() => setIsBuyMenuOpen(open => !open)}
                                        className={cn(
                                            "text-[0.95rem] font-semibold uppercase tracking-wider hover:text-primary transition-colors pb-1 relative group flex items-center gap-1.5",
                                            buyCarsActive ? "text-primary" : "opacity-80 hover:opacity-100"
                                        )}
                                    >
                                        Buy Cars
                                        <ChevronDown
                                            size={14}
                                            className={cn("transition-transform", isBuyMenuOpen && "rotate-180")}
                                        />
                                        <span className={cn(
                                            "absolute bottom-0 left-0 w-full h-[2px] bg-primary transform scale-x-0 transition-transform group-hover:scale-x-100",
                                            buyCarsActive && "scale-x-100"
                                        )} />
                                    </button>

                                    {isBuyMenuOpen && (
                                        <div
                                            role="menu"
                                            className="absolute left-1/2 top-full z-[80] mt-3 w-72 -translate-x-1/2 overflow-hidden rounded-2xl border shadow-2xl"
                                            style={{
                                                background: "var(--bg-dropdown)",
                                                borderColor: "var(--border-default)",
                                            }}
                                        >
                                            <Link
                                                href="/search"
                                                role="menuitem"
                                                className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-primary/5"
                                                onClick={() => setIsBuyMenuOpen(false)}
                                            >
                                                <Car size={19} className="mt-0.5 text-primary shrink-0" />
                                                <span className="text-left">
                                                    <span className="block text-sm font-bold">Retail Listings</span>
                                                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                                                        Browse cars advertised for retail buyers.
                                                    </span>
                                                </span>
                                            </Link>
                                            <div className="h-px bg-[var(--border-default)]" />
                                            <Link
                                                href="/auctions/browse"
                                                role="menuitem"
                                                className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-primary/5"
                                                onClick={() => setIsBuyMenuOpen(false)}
                                            >
                                                <Gavel size={19} className="mt-0.5 text-primary shrink-0" />
                                                <span className="min-w-0 text-left">
                                                    <span className="flex items-center gap-2 text-sm font-bold">
                                                        Live Auctions
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-500">
                                                            <ShieldCheck size={10} /> Verified Dealers
                                                        </span>
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                                                        Trade auctions for KYC-approved dealers only.
                                                    </span>
                                                </span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        if (link.kind === "sell-menu") {
                            return (
                                <div
                                    key={link.name}
                                    className="relative"
                                    onMouseEnter={() => {
                                        setIsSellMenuOpen(true)
                                        setIsBuyMenuOpen(false)
                                        setIsTradeMenuOpen(false)
                                    }}
                                    onMouseLeave={() => setIsSellMenuOpen(false)}
                                >
                                    <button
                                        type="button"
                                        aria-expanded={isSellMenuOpen}
                                        aria-haspopup="menu"
                                        onClick={() => {
                                            setIsSellMenuOpen(open => !open)
                                            setIsBuyMenuOpen(false)
                                            setIsTradeMenuOpen(false)
                                        }}
                                        className={cn(
                                            "text-[0.95rem] font-semibold uppercase tracking-wider hover:text-primary transition-colors pb-1 relative group flex items-center gap-1.5",
                                            sellCarsActive ? "text-primary" : "opacity-80 hover:opacity-100"
                                        )}
                                    >
                                        Sell Cars
                                        <ChevronDown size={14} className={cn("transition-transform", isSellMenuOpen && "rotate-180")} />
                                        <span className={cn(
                                            "absolute bottom-0 left-0 w-full h-[2px] bg-primary transform scale-x-0 transition-transform group-hover:scale-x-100",
                                            sellCarsActive && "scale-x-100"
                                        )} />
                                    </button>

                                    {isSellMenuOpen && (
                                        <div
                                            role="menu"
                                            className="absolute left-1/2 top-full z-[80] mt-3 w-72 -translate-x-1/2 overflow-hidden rounded-2xl border shadow-2xl"
                                            style={{ background: "var(--bg-dropdown)", borderColor: "var(--border-default)" }}
                                        >
                                            <Link
                                                href="/sell?sellMode=retail#sell-options"
                                                role="menuitem"
                                                className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-primary/5"
                                                onClick={() => setIsSellMenuOpen(false)}
                                            >
                                                <Car size={19} className="mt-0.5 text-primary shrink-0" />
                                                <span className="text-left">
                                                    <span className="block text-sm font-bold">Retail Listing</span>
                                                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">Advertise directly to retail buyers from £1.</span>
                                                </span>
                                            </Link>
                                            <div className="h-px bg-[var(--border-default)]" />
                                            <Link
                                                href="/sell?sellMode=auction#sell-options"
                                                role="menuitem"
                                                className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-primary/5"
                                                onClick={() => setIsSellMenuOpen(false)}
                                            >
                                                <Gavel size={19} className="mt-0.5 text-primary shrink-0" />
                                                <span className="text-left">
                                                    <span className="block text-sm font-bold">Auction Listing</span>
                                                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">List free and let verified dealers bid.</span>
                                                </span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        if (link.kind === "trade-menu") {
                            const tradeItems = [
                                { name: "TradeXchange Overview", href: "/auctions", icon: LayoutGrid, desc: "See every TradeXchange service area." },
                                { name: "Vehicle Auctions", href: "/auctions/how-it-works", icon: Gavel, desc: "Buy and sell trade stock through live auctions." },
                                { name: "Delivery & Recovery", href: "/services/delivery", icon: Truck, desc: "Arrange vehicle transport and recovery." },
                                { name: "Vehicle Inspection", href: "/services/inspection", icon: Wrench, desc: "Request independent vehicle inspections." },
                                { name: "Vehicle Finance", href: "/services/finance", icon: Banknote, desc: "Request options from approved finance providers." },
                                { name: "Warranty", href: "/services/warranty", icon: ShieldCheck, desc: "Request vehicle warranty options." },
                            ]
                            return (
                                <div
                                    key={link.name}
                                    className="relative"
                                    onMouseEnter={() => {
                                        setIsTradeMenuOpen(true)
                                        setIsBuyMenuOpen(false)
                                        setIsSellMenuOpen(false)
                                    }}
                                    onMouseLeave={() => setIsTradeMenuOpen(false)}
                                >
                                    <button
                                        type="button"
                                        aria-expanded={isTradeMenuOpen}
                                        aria-haspopup="menu"
                                        onClick={() => {
                                            setIsTradeMenuOpen(open => !open)
                                            setIsBuyMenuOpen(false)
                                            setIsSellMenuOpen(false)
                                        }}
                                        className={cn(
                                            "text-[0.95rem] font-semibold uppercase tracking-wider hover:text-primary transition-colors pb-1 relative group flex items-center gap-1.5",
                                            tradeXchangeActive ? "text-primary" : "opacity-80 hover:opacity-100"
                                        )}
                                    >
                                        TradeXchange
                                        <ChevronDown size={14} className={cn("transition-transform", isTradeMenuOpen && "rotate-180")} />
                                        <span className={cn(
                                            "absolute bottom-0 left-0 w-full h-[2px] bg-primary transform scale-x-0 transition-transform group-hover:scale-x-100",
                                            tradeXchangeActive && "scale-x-100"
                                        )} />
                                    </button>

                                    {isTradeMenuOpen && (
                                        <div
                                            role="menu"
                                            className="absolute left-1/2 top-full z-[80] mt-3 w-80 -translate-x-1/2 overflow-hidden rounded-2xl border shadow-2xl"
                                            style={{ background: "var(--bg-dropdown)", borderColor: "var(--border-default)" }}
                                        >
                                            {tradeItems.map((item, index) => {
                                                const Icon = item.icon
                                                return (
                                                    <React.Fragment key={item.href}>
                                                        {index > 0 && <div className="h-px bg-[var(--border-default)]" />}
                                                        <Link
                                                            href={item.href}
                                                            role="menuitem"
                                                            className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-primary/5"
                                                            onClick={() => setIsTradeMenuOpen(false)}
                                                        >
                                                            <Icon size={18} className="mt-0.5 text-primary shrink-0" />
                                                            <span className="text-left">
                                                                <span className="block text-sm font-bold">{item.name}</span>
                                                                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{item.desc}</span>
                                                            </span>
                                                        </Link>
                                                    </React.Fragment>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        return (
                            <Link
                                key={link.name}
                                href={link.href}
                                prefetch={link.prefetch}
                                aria-current={activeLink === link.href ? "page" : undefined}
                                className={cn(
                                    "text-[0.95rem] font-semibold uppercase tracking-wider hover:text-primary transition-colors pb-1 relative group flex items-center gap-1.5",
                                    activeLink === link.href ? "text-primary" : "opacity-80 hover:opacity-100"
                                )}
                            >
                                {link.name}
                                {link.badge && (
                                    <span className="flex items-center gap-0.5 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none">
                                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                                        {link.badge}
                                    </span>
                                )}
                                <span className={cn(
                                    "absolute bottom-0 left-0 w-full h-[2px] bg-primary transform scale-x-0 transition-transform group-hover:scale-x-100",
                                    activeLink === link.href && "scale-x-100"
                                )} />
                            </Link>
                        )
                    })}
                </nav>

                {/* Action Buttons */}
                <div className="flex-1 flex items-center justify-end gap-2 lg:gap-3">
                    <div className="hidden lg:block">
                        <ThemeToggle />
                    </div>

                    {!loading && user && (
                        <NotificationBell />
                    )}

                    {!loading && user ? (
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                aria-expanded={isUserMenuOpen}
                                aria-haspopup="true"
                                aria-controls="account-menu"
                                aria-label={isUserMenuOpen ? "Close account menu" : "Open account menu"}
                                className="flex items-center gap-2 lg:gap-3 px-2.5 py-2 lg:px-3 rounded-xl hover:opacity-90 border transition-all group"
                                style={{
                                    background: 'var(--bg-card)',
                                    borderColor: 'var(--border-default)',
                                }}
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                    {profile?.firstName?.[0] || user.email?.[0].toUpperCase()}
                                </div>
                                <span className="hidden lg:block font-semibold text-sm">
                                    {profile?.firstName || 'Account'}
                                </span>
                                <ChevronDown size={14} className={cn("opacity-60 group-hover:opacity-100 transition-transform", isUserMenuOpen && "rotate-180")} />
                            </button>

                            {/* User Dropdown */}
                            {isUserMenuOpen && (
                                <div
                                    id="account-menu"
                                    className="absolute top-full right-0 mt-2 w-56 border rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200"
                                    style={{
                                        background: 'var(--bg-dropdown)',
                                        borderColor: 'var(--border-default)',
                                    }}
                                >
                                    <div className="px-4 py-3 border-b mb-2" style={{ borderColor: 'var(--border-default)' }}>
                                        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Signed in as</p>
                                        <p className="text-sm font-semibold truncate">{user.email}</p>
                                    </div>
                                    <Link
                                        href={profile?.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard'}
                                        onClick={() => setIsUserMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2 hover:bg-primary/5 text-sm transition-colors"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        <Car size={16} /> Dashboard
                                    </Link>
                                    <Link
                                        href="/profile"
                                        onClick={() => setIsUserMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2 hover:bg-primary/5 text-sm transition-colors"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        <UserIcon size={16} /> Profile Settings
                                    </Link>
                                    <div
                                        className="lg:hidden flex items-center justify-between px-4 py-2 text-sm"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        <span>Theme</span>
                                        <ThemeToggle />
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-sm mt-2 border-t pt-4 pb-2"
                                        style={{ borderColor: 'var(--border-default)' }}
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <Button
                                asChild
                                variant="ghost"
                                className="hidden lg:flex text-sm font-semibold hover:text-primary transition-colors"
                            >
                                <Link href="/auth/signup">
                                    Sign Up
                                </Link>
                            </Button>

                            <Button
                                asChild
                                variant="default"
                                shape="default"
                                className="hidden lg:flex gap-2 font-bold px-6 bg-gradient-to-br from-[#ff4d4d] to-[#ed1c24] hover:from-[#ff6b6b] hover:to-[#ff0033]"
                            >
                                <Link href="/auth/login">
                                    <LogIn size={18} /> Login
                                </Link>
                            </Button>
                        </>
                    )}

                    <button
                        className="lg:hidden text-2xl ml-2"
                        onClick={toggleMenu}
                        aria-expanded={isMobileMenuOpen}
                        aria-controls="mobile-main-menu"
                        aria-label={isMobileMenuOpen ? "Close main menu" : "Open main menu"}
                    >
                        {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div
                    id="mobile-main-menu"
                    className="lg:hidden absolute top-full left-0 w-full shadow-xl border-t animate-in slide-in-from-top-2 max-h-[calc(100vh-5rem)] overflow-y-auto"
                    style={{
                        background: 'var(--bg-dropdown)',
                        borderColor: 'var(--border-default)',
                    }}
                >
                    <nav className="flex flex-col p-6 gap-4 text-center">
                        {!user && (
                            <div className="flex items-center justify-center pb-2">
                                <ThemeToggle />
                            </div>
                        )}
                        {visibleNavLinks.map((link) => {
                            if (link.kind === "buy-menu") {
                                return (
                                    <div key={link.name} className="w-full">
                                        <button
                                            type="button"
                                            aria-expanded={isBuyMenuOpen}
                                            onClick={() => setIsBuyMenuOpen(open => !open)}
                                            className={cn(
                                                "w-full text-lg font-medium py-2 hover:text-primary transition-colors flex items-center justify-center gap-2",
                                                buyCarsActive && "text-primary"
                                            )}
                                        >
                                            Buy Cars
                                            <ChevronDown
                                                size={18}
                                                className={cn("transition-transform", isBuyMenuOpen && "rotate-180")}
                                            />
                                        </button>

                                        {isBuyMenuOpen && (
                                            <div className="mx-auto mt-2 w-full max-w-md overflow-hidden rounded-2xl border text-left"
                                                style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
                                            >
                                                <Link
                                                    href="/search"
                                                    className="flex items-start gap-3 px-4 py-4 hover:bg-primary/5 transition-colors"
                                                    onClick={() => {
                                                        setIsBuyMenuOpen(false)
                                                        setIsMobileMenuOpen(false)
                                                    }}
                                                >
                                                    <Car size={20} className="mt-0.5 text-primary shrink-0" />
                                                    <span>
                                                        <span className="block font-bold">Retail Listings</span>
                                                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                                                            Cars advertised for retail buyers.
                                                        </span>
                                                    </span>
                                                </Link>
                                                <div className="h-px bg-[var(--border-default)]" />
                                                <Link
                                                    href="/auctions/browse"
                                                    className="flex items-start gap-3 px-4 py-4 hover:bg-primary/5 transition-colors"
                                                    onClick={() => {
                                                        setIsBuyMenuOpen(false)
                                                        setIsMobileMenuOpen(false)
                                                    }}
                                                >
                                                    <Gavel size={20} className="mt-0.5 text-primary shrink-0" />
                                                    <span className="min-w-0">
                                                        <span className="flex flex-wrap items-center gap-2 font-bold">
                                                            Live Auctions
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-500">
                                                                <ShieldCheck size={10} /> Verified Dealers
                                                            </span>
                                                        </span>
                                                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                                                            KYC-approved dealer access only.
                                                        </span>
                                                    </span>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )
                            }

                            if (link.kind === "sell-menu") {
                                return (
                                    <div key={link.name} className="w-full">
                                        <button
                                            type="button"
                                            aria-expanded={isSellMenuOpen}
                                            onClick={() => {
                                                setIsSellMenuOpen(open => !open)
                                                setIsBuyMenuOpen(false)
                                                setIsTradeMenuOpen(false)
                                            }}
                                            className={cn(
                                                "w-full text-lg font-medium py-2 hover:text-primary transition-colors flex items-center justify-center gap-2",
                                                sellCarsActive && "text-primary"
                                            )}
                                        >
                                            Sell Cars
                                            <ChevronDown size={18} className={cn("transition-transform", isSellMenuOpen && "rotate-180")} />
                                        </button>

                                        {isSellMenuOpen && (
                                            <div
                                                className="mx-auto mt-2 w-full max-w-md overflow-hidden rounded-2xl border text-left"
                                                style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
                                            >
                                                <Link
                                                    href="/sell?sellMode=retail#sell-options"
                                                    className="flex items-start gap-3 px-4 py-4 hover:bg-primary/5 transition-colors"
                                                    onClick={() => {
                                                        setIsSellMenuOpen(false)
                                                        setIsMobileMenuOpen(false)
                                                    }}
                                                >
                                                    <Car size={20} className="mt-0.5 text-primary shrink-0" />
                                                    <span>
                                                        <span className="block font-bold">Retail Listing</span>
                                                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">Advertise directly to retail buyers from £1.</span>
                                                    </span>
                                                </Link>
                                                <div className="h-px bg-[var(--border-default)]" />
                                                <Link
                                                    href="/sell?sellMode=auction#sell-options"
                                                    className="flex items-start gap-3 px-4 py-4 hover:bg-primary/5 transition-colors"
                                                    onClick={() => {
                                                        setIsSellMenuOpen(false)
                                                        setIsMobileMenuOpen(false)
                                                    }}
                                                >
                                                    <Gavel size={20} className="mt-0.5 text-primary shrink-0" />
                                                    <span>
                                                        <span className="block font-bold">Auction Listing</span>
                                                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">List free and let verified dealers bid.</span>
                                                    </span>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )
                            }

                            if (link.kind === "trade-menu") {
                                const tradeItems = [
                                    { name: "TradeXchange Overview", href: "/auctions", icon: LayoutGrid },
                                    { name: "Vehicle Auctions", href: "/auctions/how-it-works", icon: Gavel },
                                    { name: "Delivery & Recovery", href: "/services/delivery", icon: Truck },
                                    { name: "Vehicle Inspection", href: "/services/inspection", icon: Wrench },
                                    { name: "Vehicle Finance", href: "/services/finance", icon: Banknote },
                                    { name: "Warranty", href: "/services/warranty", icon: ShieldCheck },
                                ]
                                return (
                                    <div key={link.name} className="w-full">
                                        <button
                                            type="button"
                                            aria-expanded={isTradeMenuOpen}
                                            onClick={() => {
                                                setIsTradeMenuOpen(open => !open)
                                                setIsBuyMenuOpen(false)
                                                setIsSellMenuOpen(false)
                                            }}
                                            className={cn(
                                                "w-full text-lg font-medium py-2 hover:text-primary transition-colors flex items-center justify-center gap-2",
                                                tradeXchangeActive && "text-primary"
                                            )}
                                        >
                                            TradeXchange
                                            <ChevronDown size={18} className={cn("transition-transform", isTradeMenuOpen && "rotate-180")} />
                                        </button>

                                        {isTradeMenuOpen && (
                                            <div
                                                className="mx-auto mt-2 w-full max-w-md overflow-hidden rounded-2xl border text-left"
                                                style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
                                            >
                                                {tradeItems.map((item, index) => {
                                                    const Icon = item.icon
                                                    return (
                                                        <React.Fragment key={item.href}>
                                                            {index > 0 && <div className="h-px bg-[var(--border-default)]" />}
                                                            <Link
                                                                href={item.href}
                                                                className="flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition-colors"
                                                                onClick={() => {
                                                                    setIsTradeMenuOpen(false)
                                                                    setIsMobileMenuOpen(false)
                                                                }}
                                                            >
                                                                <Icon size={19} className="text-primary shrink-0" />
                                                                <span className="font-bold">{item.name}</span>
                                                            </Link>
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            }

                            return (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    prefetch={link.prefetch}
                                    className={cn(
                                        "text-lg font-medium py-2 hover:text-primary transition-colors flex items-center justify-center gap-2",
                                        activeLink === link.href && "text-primary"
                                    )}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link.name}
                                    {link.badge && (
                                        <span className="flex items-center gap-0.5 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none">
                                            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                                            {link.badge}
                                        </span>
                                    )}
                                </Link>
                            )
                        })}



                        {!user ? (
                            <>
                                <Button asChild variant="outline" className="w-full mt-4 hover:bg-primary/5">
                                    <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
                                        Sign Up
                                    </Link>
                                </Button>
                                <Button asChild className="w-full mt-2">
                                    <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                                        Login
                                    </Link>
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" className="w-full mt-4 text-red-400 hover:bg-red-500/10" onClick={handleSignOut}>
                                Sign Out
                            </Button>
                        )}
                    </nav>
                </div>
            )}
        </header>
    )
}
