import Link from "next/link"
import { ShieldCheck, Scale, AlertTriangle, FileText, CheckCircle, Info } from "lucide-react"

export const metadata = {
    title: 'Terms & Conditions - CarMazium',
    description: 'Terms and Conditions for using the CarMazium platform.',
}

export default function TermsPage() {
    return (
        <div className="min-h-screen pt-32 pb-20 relative">
            <div className="absolute inset-0 -z-10" style={{ background: 'var(--bg-body)' }} />

            <div className="container mx-auto px-5 max-w-4xl">
                {/* Header Header */}
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 text-primary mb-6 shadow-[0_0_30px_rgba(237,28,36,0.2)]">
                        <Scale size={32} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-heading font-black mb-6 uppercase tracking-tight">Terms & Conditions</h1>
                    <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">
                        Please read these terms carefully before using the CarMazium platform. By accessing or using our services, you agree to be bound by these policies.
                    </p>
                </div>

                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                    {/* 1. Platform Role */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">1</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Platform Role (Important)</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13">
                            <p><strong>Carmazium is strictly an online marketplace.</strong></p>
                            <ul className="list-disc pl-5 space-y-2 text-sm">
                                <li>We do <strong>NOT</strong> buy, sell, or own the cars listed on our platform.</li>
                                <li>Any deal or transaction is exclusively between you and the other party (buyer or dealer).</li>
                                <li>Carmazium is <strong>not</strong> part of the sales contract.</li>
                            </ul>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4 flex gap-3 text-blue-200 text-sm">
                                <Info className="shrink-0 text-blue-400" size={18} />
                                <p><strong>Meaning:</strong> If something goes wrong with a vehicle, you must resolve it directly with the dealer or seller, not Carmazium.</p>
                            </div>
                        </div>
                    </section>

                    {/* 2. Acceptance of terms */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">2</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Acceptance of Terms</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <p>By using the Carmazium platform, you automatically agree to these Terms & Conditions. If you do not agree with any part of these terms, you must not use the site. We may update these terms at any time, and continued use signifies your acceptance of the changes.</p>
                        </div>
                    </section>

                    {/* 3. User responsibilities */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">3</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">User Responsibilities</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-4 pl-13 text-sm">
                            <p>When listing or using Carmazium, you must:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Provide accurate and complete vehicle information.</li>
                                <li>Own the vehicle or have the legal right to sell it.</li>
                                <li>Declare your status honestly (Dealers must declare they are traders and cannot pretend to be private sellers).</li>
                            </ul>
                            <p className="font-bold mt-4">You must ensure that:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>The stated mileage is correct.</li>
                                <li>There is no hidden damage or outstanding undisclosed finance.</li>
                                <li>No misleading photos or descriptions are used.</li>
                            </ul>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4 flex gap-3 text-amber-200 text-sm">
                                <AlertTriangle className="shrink-0 text-amber-500" size={18} />
                                <p><strong>Warning:</strong> If you provide false information, you may face immediate account suspension and potential legal claims from affected buyers.</p>
                            </div>
                        </div>
                    </section>

                    {/* 4. Content & data rights */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">4</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Content & Data Rights</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <p>By listing a vehicle, you grant Carmazium a worldwide license to use your photos and content. We reserve the right to:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Use your photos and data for marketing and platform improvements.</li>
                                <li>Edit, suspend, or remove listings at any time without prior notice.</li>
                            </ul>
                        </div>
                    </section>

                    {/* 5. Buying a car policy */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">5</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Buying & Offers Policy</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <p>Offers made by dealers or buyers are <strong>NOT</strong> legally binding until a final contract is signed off-platform. Offers can be changed or withdrawn at any time. Carmazium provides no guarantee that you will receive offers or that the price estimated will remain the same.</p>
                        </div>
                    </section>

                    {/* 6. Selling & Auctions */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">6</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Selling & Auction Rules</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <ul className="list-disc pl-5 space-y-2">
                                <li>You may set a reserve price for your vehicle.</li>
                                <li>Dealers and buyers bid on or make offers for your car.</li>
                                <li>The vehicle sells only if the reserve is met and both parties agree to finalize.</li>
                            </ul>
                            <p className="mt-4 font-bold">Important Rules:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>There is absolutely no guarantee of a sale.</li>
                                <li>Price estimates generated by our tools may be inaccurate.</li>
                                <li>Carmazium reserves the right to cancel listings or remove bids at any time.</li>
                            </ul>
                        </div>
                    </section>

                    {/* 7. Inspection & Payment */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">7</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Inspection & Payment Rules</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <p>The buyer must thoroughly inspect the vehicle before transferring any payment. If the car information is incorrect or hidden damage exists, the buyer is entitled to:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Renegotiate or reduce the price.</li>
                                <li>Cancel the deal completely.</li>
                            </ul>
                            <p>Vehicle history checks provided via the platform are for informational purposes only and do not replace a physical inspection.</p>
                        </div>
                    </section>

                    {/* 8. Liability */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                                <span className="font-bold">8</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Liability & No Guarantees</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <p>The Carmazium website and services are provided "as is". We offer NO guarantees regarding the condition of vehicles, accuracy of advertisements, or authenticity of ownership. Even with our security checks, fraud or scams may exist.</p>
                            <p className="font-bold text-red-400 mt-4">Carmazium is NOT responsible or liable for:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Payments, financial losses, or business losses.</li>
                                <li>The mechanical or physical condition of any vehicle.</li>
                                <li>Disputes arising between buyers and sellers.</li>
                                <li>Incorrect listings, scams, or fraudulent activity.</li>
                            </ul>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4 flex gap-3 text-red-200 text-sm">
                                <AlertTriangle className="shrink-0 text-red-500" size={18} />
                                <p><strong>All risk is entirely on the users.</strong> You must do your own checks, inspections, and due diligence before purchasing or selling a vehicle.</p>
                            </div>
                        </div>
                    </section>

                    {/* 9. Prohibited Use */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">9</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Prohibited Use</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <p>You must NOT:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Post illegal, offensive, or harmful content.</li>
                                <li>Upload viruses, malicious code, or hack the platform.</li>
                                <li>Mislead buyers or sellers intentionally.</li>
                                <li>Copy, scrape, or reuse site content for commercial purposes.</li>
                                <li>Violate any local, national, or international laws.</li>
                            </ul>
                            <p className="text-red-400 font-bold mt-2">Violation of these rules will lead to an immediate account ban and potential legal action.</p>
                        </div>
                    </section>

                    {/* 10. Jurisdiction */}
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="font-bold">10</span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">Legal Jurisdiction & Age Limit</h2>
                        </div>
                        <div className="text-[var(--text-secondary)] space-y-3 pl-13 text-sm leading-relaxed">
                            <p>You must be at least 18 years of age to register an account and use the Carmazium platform. You must provide accurate registration information.</p>
                            <p>These terms and any disputes arising from them are governed exclusively by the laws of the United Kingdom (England & Wales).</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
