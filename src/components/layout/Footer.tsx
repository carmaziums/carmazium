"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { Mail, Phone, MapPin } from "lucide-react"
import { useConsent } from "@/context/ConsentContext"

const footerLinkClass = "rounded-sm text-sm text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"

export function Footer() {
    const { openPreferences } = useConsent()

    return (
        <footer className="mt-auto border-t border-white/10 bg-gradient-to-t from-[#172033] to-[#24324f] text-white">
            <div className="container mx-auto px-5 py-12 lg:py-14">
                <div className="grid grid-cols-1 gap-9 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">
                    <div>
                        <Link
                            href="/"
                            className="inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        >
                            <Image
                                src="/assets/images/logo.png"
                                alt="CarMazium"
                                width={400}
                                height={100}
                                className="h-9 w-auto"
                                priority
                            />
                        </Link>
                        <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
                            CarMazium brings vehicle buying, selling and automotive services together in one UK marketplace with clear, purpose-built workflows.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">Marketplace</h3>
                        <ul className="mt-4 grid gap-2.5">
                            <li><Link href="/" className={footerLinkClass}>Home</Link></li>
                            <li><Link href="/search" className={footerLinkClass}>Buy Cars</Link></li>
                            <li><Link href="/sell" className={footerLinkClass}>Sell Cars</Link></li>
                            <li><Link href="/auctions" className={footerLinkClass}>TradeXchange</Link></li>
                            <li><Link href="/services" className={footerLinkClass}>Services Hub</Link></li>
                            <li><Link href="/compare" className={footerLinkClass}>Compare Cars</Link></li>
                            <li><Link href="/pricing" className={footerLinkClass}>Pricing</Link></li>
                            <li><Link href="/about" className={footerLinkClass}>About</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">Contact</h3>
                        <ul className="mt-4 space-y-3 text-sm text-slate-300">
                            <li>
                                <a href="mailto:info@carmazium.com" className="flex items-center gap-3 rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                    <Mail size={17} className="shrink-0 text-red-300" />
                                    <span>info@carmazium.com</span>
                                </a>
                            </li>
                            <li>
                                <a href="tel:+441218385040" className="flex items-center gap-3 rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                    <Phone size={17} className="shrink-0 text-red-300" />
                                    <span>0121 838 5040</span>
                                </a>
                            </li>
                            <li className="flex items-start gap-3 leading-6">
                                <MapPin size={17} className="mt-1 shrink-0 text-red-300" />
                                <span>181-187 Hunters Rd, Lozells,<br />Birmingham, B19 1ES,<br />United Kingdom</span>
                            </li>
                            <li className="pl-7 text-xs text-slate-400">Mon – Fri, 9am – 6pm GMT</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">Newsletter</h3>
                        <p className="mt-4 text-sm leading-6 text-slate-300">Car deals, listing alerts and useful market updates, delivered without clutter.</p>
                        <form className="mt-4 space-y-2">
                            <label htmlFor="footer-email" className="sr-only">Email address</label>
                            <input
                                id="footer-email"
                                type="email"
                                placeholder="Email address"
                                className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.07] px-4 text-sm text-white placeholder:text-slate-400 transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                            />
                            <Button className="w-full">Subscribe</Button>
                        </form>
                    </div>
                </div>

                <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>&copy; {new Date().getFullYear()} CarMazium. All Rights Reserved.</p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <Link href="/terms" className={footerLinkClass}>Terms & Conditions</Link>\n                        <Link href="/privacy-policy" className={footerLinkClass}>Privacy Policy</Link>\n                        <Link href="/delete-account" className={footerLinkClass}>Delete Account</Link>
                        <Link href="/cookie-policy" className={footerLinkClass}>Cookie Policy</Link>
                        <button
                            onClick={openPreferences}
                            className="rounded-sm text-sm text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            Cookie Preferences
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    )
}
