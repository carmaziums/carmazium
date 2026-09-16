"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { Mail, Phone, MapPin } from "lucide-react"
import { useConsent } from "@/context/ConsentContext"

export function Footer() {
    const { openPreferences } = useConsent()
    return (
        <footer className="bg-gradient-to-t from-[#1e293b] to-[#2d3c63] text-white pt-14 pb-8 border-t border-white/5 mt-auto">
            <div className="container mx-auto px-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
                    <div className="space-y-4">
                        <Link href="/" className="inline-block">
                            <Image src="/assets/images/logo.png" alt="CarMazium" width={400} height={100} className="h-10 w-auto" priority />
                        </Link>
                        <p className="text-gray-300/80 text-sm leading-relaxed max-w-sm">
                            CarMazium is a UK automotive marketplace for buying, selling, dealer auctions and TradeXchange vehicle services.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Explore</h3>
                        <ul className="space-y-2.5 text-sm text-gray-300/80">
                            <li><Link href="/search" className="hover:text-primary transition-colors">Buy Cars</Link></li>
                            <li><Link href="/sell" className="hover:text-primary transition-colors">Sell Cars</Link></li>
                            <li><Link href="/auctions" className="hover:text-primary transition-colors">TradeXchange</Link></li>
                            <li><Link href="/compare" className="hover:text-primary transition-colors">Compare Vehicles</Link></li>
                            <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
                            <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
                            <li><Link href="/terms" className="hover:text-primary transition-colors">Terms &amp; Conditions</Link></li>
                            <li><Link href="/cookie-policy" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Contact</h3>
                        <ul className="space-y-3 text-sm text-gray-300/80">
                            <li className="flex items-center gap-3 hover:text-primary transition-colors"><Mail size={17} className="text-primary shrink-0" /><a href="mailto:info@carmazium.com">info@carmazium.com</a></li>
                            <li className="flex items-center gap-3 hover:text-primary transition-colors"><Phone size={17} className="text-primary shrink-0" /><a href="tel:+441218385040">0121 838 5040</a></li>
                            <li className="flex items-start gap-3"><MapPin size={17} className="text-primary shrink-0 mt-0.5" /><span>181-187 Hunters Rd, Lozells,<br />Birmingham, B19 1ES,<br />United Kingdom</span></li>
                            <li className="text-xs text-gray-400 pl-7">Mon – Fri, 9am – 6pm GMT</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Newsletter</h3>
                        <p className="text-gray-300/80 text-sm leading-relaxed">Car deals, listing alerts and automotive market updates.</p>
                        <form className="flex flex-col gap-2">
                            <input type="email" placeholder="Your email" className="h-11 rounded-xl px-4 bg-white/5 border border-white/10 text-white placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-colors" />
                            <Button className="w-full">Subscribe</Button>
                        </form>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-7 text-center text-gray-400 text-sm flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                    <p>&copy; {new Date().getFullYear()} CarMazium. All Rights Reserved.</p>
                    <button onClick={openPreferences} className="hover:text-primary transition-colors underline underline-offset-2">Cookie Preferences</button>
                </div>
            </div>
        </footer>
    )
}
