"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X, LogIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"

const navLinks = [
    { name: "Home", href: "/" },
    { name: "Buy Cars", href: "/search" },
    { name: "Sell Cars", href: "/sell" },
    { name: "Service Hub", href: "/services" },
    { name: "About", href: "/about" },
]

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const [activeLink, setActiveLink] = React.useState("")
    const pathname = usePathname()

    React.useEffect(() => {
        setActiveLink(pathname || "")
    }, [pathname])

    const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

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
                        {/* Using Next.js Image. Path assumes public/assets exists */}
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
                    </nav>
                </div>
            )}
        </header>
    )
}
