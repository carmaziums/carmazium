import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { Mail, Phone, MapPin } from "lucide-react"

export function Footer() {
    return (
        <footer className="bg-gradient-to-t from-[#1e293b] to-[#2d3c63] text-white pt-16 pb-8 border-t border-white/5 mt-auto">
            <div className="container mx-auto px-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

                    {/* Brand Column */}
                    <div className="space-y-4">
                        <Link href="/" className="inline-block">
                            <Image
                                src="/assets/images/logo.png"
                                alt="CarMazium"
                                width={400}
                                height={100}
                                className="h-10 w-auto"
                                priority
                            />
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Carmazium is a next-generation car marketplace built for buying and selling vehicles securely. We connect buyers and sellers through verified listings and intelligent pricing.
                        </p>
                        <div className="flex gap-4">
                            {/* Social placeholders */}
                        </div>
                    </div>

                    {/* Links Column */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold font-heading uppercase tracking-wide">Page</h3>
                        <ul className="space-y-2 text-gray-400">
                            <li><Link href="/" className="hover:text-primary transition-colors">Home</Link></li>
                            <li><Link href="/search" className="hover:text-primary transition-colors">Buy Cars</Link></li>
                            <li><Link href="/auctions" className="hover:text-primary transition-colors">Auctions</Link></li>
                            <li><Link href="/sell" className="hover:text-primary transition-colors">Sell Cars</Link></li>
                            <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
                            <li><Link href="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
                        </ul>
                    </div>

                    {/* Contact Column */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold font-heading uppercase tracking-wide">Contact Us</h3>
                        <ul className="space-y-2 text-gray-400">
                            <li className="hover:text-primary cursor-pointer transition-colors flex items-center gap-3">
                                <Mail size={18} className="text-primary shrink-0" /> support@carmazium.co.uk
                            </li>
                            <li className="hover:text-primary cursor-pointer transition-colors flex items-center gap-3">
                                <Phone size={18} className="text-primary shrink-0" /> 0800 123 4567
                            </li>
                            <li className="hover:text-primary cursor-pointer transition-colors flex items-center gap-3">
                                <MapPin size={18} className="text-primary shrink-0" /> London, UK
                            </li>
                        </ul>
                    </div>

                    {/* Newsletter Column */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold font-heading uppercase tracking-wide">Newsletter</h3>
                        <p className="text-gray-400 text-sm">Subscribe to receive car deals, listing alerts, and market insights.</p>
                        <form className="flex flex-col gap-2">
                            <input
                                type="email"
                                placeholder="Your Email"
                                className="px-4 py-3 bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                            />
                            <Button className="w-full">Subscribe</Button>
                        </form>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 text-center text-gray-500 text-sm">
                    <p>&copy; 2025 CarMazium. All Rights Reserved.</p>
                </div>
            </div>
        </footer>
    )
}
