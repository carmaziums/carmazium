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
        <header className="fixed top-0 left-0 w-full z-50 border-b shadow-2xl transition-all duration-300"
            style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
            }}
        >
            <div 
                className="absolute inset-0 -z-10 backdrop-blur-xl bg-slate-900/90"
                style={{ 
                    background: 'var(--bg-header)',
                    WebkitTransform: 'translate3d(0,0,0)',
                    transform: 'translate3d(0,0,0)' 
                }} 
            />
            <div className="container mx-auto px-6 flex items-center justify-between h-20 relative z-10">

                {/* Logo Area */}
                <div className="flex-1 flex items-center justify-start gap-6">
                    <button
                        className="md:hidden text-2xl focus:outline-none"
                        onClick={toggleMenu}
                        aria-label="Toggle Menu"
                    >
                        {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>

                    <Link href="/" className="flex items-center">
                        <Image
                            src="/assets/images/logo.png"
                            alt="CarMazium"
                            width={400}
                            height={100}
                            className="h-10 w-auto"
                            priority
                        />
                    </Link>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden md:flex flex-none justify-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                "text-[0.95rem] font-semibold uppercase tracking-wider hover:text-primary transition-colors pb-1 relative group",
                                activeLink === link.href ? "text-primary" : "opacity-80 hover:opacity-100"
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
                <div className="flex-1 flex items-center justify-end gap-3">

                    {!loading && user ? (
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:opacity-90 border transition-all group"
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
                                        href="/dashboard"
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
                                className="hidden md:flex text-sm font-semibold hover:text-primary transition-colors"
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
                <div
                    className="md:hidden absolute top-full left-0 w-full shadow-xl border-t animate-in slide-in-from-top-2"
                    style={{
                        background: 'var(--bg-dropdown)',
                        borderColor: 'var(--border-default)',
                    }}
                >
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
                                <Button asChild variant="outline" className="w-full mt-4 border-white/20 hover:bg-primary/5">
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
