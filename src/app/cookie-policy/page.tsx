"use client"

import { Cookie, Lock, LineChart } from "lucide-react"
import { useConsent } from "@/context/ConsentContext"

const TRACKERS = [
    { name: "Google Tag Manager", does: "The container that loads everything below — nothing extra of its own." },
    { name: "Google Analytics", does: "Which listings, searches and pages actually get used, so we know what to fix or build next." },
    { name: "Meta Pixel", does: "Tells us if a Facebook or Instagram ad led to someone actually listing or bidding on a car." },
    { name: "TikTok Pixel", does: "Same thing, for TikTok ads." },
]

function ToggleSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            role="switch"
            aria-checked={on}
            className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${on ? "bg-primary" : "bg-[var(--border-default)]"}`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
            />
        </button>
    )
}

export default function CookiePolicyPage() {
    const { granted, acceptAll, rejectAll } = useConsent()

    return (
        <div className="min-h-screen pt-32 pb-20 relative">
            <div className="absolute inset-0 -z-10" style={{ background: 'var(--bg-body)' }} />

            <div className="container mx-auto px-5 max-w-3xl">
                {/* Header */}
                <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 text-primary mb-6 shadow-[0_0_30px_rgba(237,28,36,0.2)]">
                        <Cookie size={32} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-heading font-black mb-4 uppercase tracking-tight">Cookie Policy</h1>
                    <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">
                        Two kinds of cookies run on CarMazium. One keeps you logged in. The other tells us whether our ads
                        are actually working. Here&apos;s exactly which is which, and a switch to turn the second one off.
                    </p>
                </div>

                <div className="space-y-6 text-[var(--text-secondary)] leading-relaxed">
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Lock size={18} className="text-emerald-400 shrink-0" />
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Necessary — always on</h2>
                        </div>
                        <p className="text-sm">
                            One cookie keeps your session alive while you browse, bid, or list a car — without it you&apos;d
                            get logged out mid-auction. It&apos;s set the moment you sign in and nothing else uses it. UK law
                            doesn&apos;t require consent for this, so there&apos;s nothing to toggle here.
                        </p>
                    </section>

                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-6">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3">
                                <LineChart size={18} className="text-primary shrink-0" />
                                <h2 className="text-lg font-bold text-[var(--text-primary)]">Analytics & Marketing — your choice</h2>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                                <span className={`text-xs font-black uppercase tracking-wide ${granted ? "text-primary" : "text-[var(--text-muted)]"}`}>
                                    {granted ? "On" : "Off"}
                                </span>
                                <ToggleSwitch on={granted} onClick={() => (granted ? rejectAll() : acceptAll())} />
                            </div>
                        </div>
                        <p className="text-sm mb-4">
                            Four tools, all off by default until you flip that switch. Turn it off any time and every one of
                            them stops loading immediately — nothing else on the site changes.
                        </p>
                        <div className="divide-y divide-[var(--border-default)]">
                            {TRACKERS.map((tool) => (
                                <div key={tool.name} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                                    <p className="text-sm font-bold text-[var(--text-primary)] w-44 shrink-0">{tool.name}</p>
                                    <p className="text-sm text-[var(--text-muted)]">{tool.does}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <p className="text-center text-sm text-[var(--text-muted)]">
                        Questions? <a href="mailto:info@carmazium.com" className="text-primary hover:underline">info@carmazium.com</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
