"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, LogIn, User as UserIcon, LogOut, ChevronDown, Car } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"

const navLinks = [
    { name: "Home", href: "/" },
    { name: "Buy Cars", href: "/search" },
    { name: "Sell Cars", href: "/sell" },
    { name: "Service Hub", href: "/services" },
    { name: "About", href: "/about" },
]

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false)
    const [activeLink, setActiveLink] = React.useState("")
    const pathname = usePathname()
    const router = useRouter()
    const { user, profile, loading, signOut } = useAuth()

    React.useEffect(() => {
        setActiveLink(pathname || "")
    }, [pathname])

    const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

    const handleSignOut = async () => {
        await signOut()
        setIsUserMenuOpen(false)
        router.push('/')
    }

    return (
        <header className="fixed top-0 left-0 w-full z-50 bg-white/10 backdrop-blur-xl border-b border-white/10 shadow-2xl text-white transition-all duration-300">
            <div className="container mx-auto px-6 flex justify-between items-center h-20">

                {/* Logo Area */}
                <div className="flex items-center gap-6">
                    <button
                        className="md:hidden text-2xl text-white focus:outline-none"
                        onClick={toggleMenu}
                        aria-label="Toggle Menu"
                    >
                        {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>

                    <Link href="/" className="flex items-center">
                        <Image
                            src="/assets/images/logo.png"
                            alt="CarMazium"
                            width={160}
                            height={40}
                            className="h-10 w-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]"
                            priority
                        />
                    </Link>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden md:flex gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                "text-[0.95rem] font-semibold uppercase tracking-wider text-white/90 hover:text-primary transition-colors pb-1 relative group",
                                activeLink === link.href && "text-primary"
                            )}
                        >
                            {link.name}
                            <span className={cn(
                                "absolute bottom-0 left-0 w-full h-[2px] bg-primary transform scale-x-0 transition-transform group-hover:scale-x-100",
                                activeLink === link.href && "scale-x-100"
                            )} />
                        </Link>
                    ))}
                </nav>

                {/* Action Buttons */}
                <div className="flex items-center gap-4">
                    {!loading && user ? (
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                    {profile?.firstName?.[0] || user.email?.[0].toUpperCase()}
                                </div>
                                <span className="hidden lg:block font-semibold text-sm">
                                    {profile?.firstName || 'Account'}
                                </span>
                                <ChevronDown size={14} className={cn("text-gray-400 group-hover:text-white transition-transform", isUserMenuOpen && "rotate-180")} />
                            </button>

                            {/* User Dropdown */}
                            {isUserMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-4 py-3 border-b border-white/10 mb-2">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Signed in as</p>
                                        <p className="text-sm font-semibold truncate text-white">{user.email}</p>
                                    </div>
                                    <Link
                                        href="/dashboard"
                                        onClick={() => setIsUserMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-gray-300 hover:text-white text-sm"
                                    >
                                        <Car size={16} /> Dashboard
                                    </Link>
                                    <Link
                                        href="/profile"
                                        onClick={() => setIsUserMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-gray-300 hover:text-white text-sm"
                                    >
                                        <UserIcon size={16} /> Profile Settings
                                    </Link>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-sm mt-2 border-t border-white/5 pt-4 pb-2"
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
                                className="hidden md:flex text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <Link href="/auth/signup">
                                    Join as partner
                                </Link>
                            </Button>

                            <Button
                                asChild
                                variant="default"
                                shape="default"
                                className="hidden md:flex gap-2 font-bold px-6 bg-gradient-to-br from-[#ff4d4d] to-[#ed1c24] hover:from-[#ff6b6b] hover:to-[#ff0033]"
                            >
                                <Link href="/auth/signup">
                                    <LogIn size={18} /> Sign Up
                                </Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-secondary text-white shadow-xl border-t border-white/10 animate-in slide-in-from-top-2">
                    <nav className="flex flex-col p-6 gap-4 text-center">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={cn(
                                    "text-lg font-medium py-2 hover:text-primary transition-colors",
                                    activeLink === link.href && "text-primary"
                                )}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}
                        {!user ? (
                            <>
                                <Button asChild variant="outline" className="w-full mt-4 border-white/20 text-white hover:bg-white/10">
                                    <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
                                        Join as partner
                                    </Link>
                                </Button>
                                <Button asChild className="w-full mt-2">
                                    <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
                                        Sign Up
                                    </Link>
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" className="w-full mt-4 border-white/20 text-red-400 hover:bg-red-500/10" onClick={handleSignOut}>
                                Sign Out
                            </Button>
                        )}
                    </nav>
                </div>
            )}
        </header>
    )
}
