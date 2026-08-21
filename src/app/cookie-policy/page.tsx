import { Cookie, ShieldCheck, BarChart3, Megaphone, Settings, Mail } from "lucide-react"

export const metadata = {
    title: "Cookie Policy",
    description: "How CarMazium uses cookies, and how to change your preferences.",
}

const TOOLS = [
    { name: "Google Tag Manager", purpose: "Loads the other analytics/marketing tags below without a site update each time." },
    { name: "Google Analytics (GA4)", purpose: "Anonymised traffic and usage statistics — pages viewed, journeys through the site." },
    { name: "Meta Pixel", purpose: "Measures how effective our Facebook/Instagram ads are, and lets us show relevant ads to past visitors." },
    { name: "TikTok Pixel", purpose: "Measures how effective our TikTok ads are, and lets us show relevant ads to past visitors." },
]

export default function CookiePolicyPage() {
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
                        What cookies CarMazium uses, why, and how to change your choice at any time.
                    </p>
                </div>

                <div className="space-y-6 text-[var(--text-secondary)] leading-relaxed">
                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Strictly Necessary</h2>
                        </div>
                        <p className="text-sm">
                            These keep the site working — signing you in, remembering your session, and basic security.
                            They&apos;re always on and can&apos;t be switched off, because the site can&apos;t function without them.
                            No consent is required for these under UK law.
                        </p>
                    </section>

                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <BarChart3 size={18} className="text-primary shrink-0" />
                            <Megaphone size={18} className="text-primary shrink-0 -ml-2" />
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Analytics & Marketing</h2>
                        </div>
                        <p className="text-sm mb-4">
                            These only load if you say yes. They help us understand how the site is used and measure whether
                            our ads are working. If you decline, none of these load, and every other part of the site works exactly the same.
                        </p>
                        <div className="space-y-3">
                            {TOOLS.map((tool) => (
                                <div key={tool.name} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                    <p className="text-sm font-bold text-[var(--text-primary)]">{tool.name}</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{tool.purpose}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Settings size={18} className="text-primary shrink-0" />
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Changing Your Choice</h2>
                        </div>
                        <p className="text-sm">
                            You can accept or reject Analytics & Marketing cookies at any time from the <strong>&quot;Cookie
                            Preferences&quot;</strong> link in the footer at the bottom of every page.
                        </p>
                    </section>

                    <section className="bg-[var(--bg-card)] backdrop-blur-md rounded-2xl border border-[var(--border-default)] p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Mail size={18} className="text-primary shrink-0" />
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Questions</h2>
                        </div>
                        <p className="text-sm">
                            Contact us at <a href="mailto:info@carmazium.com" className="text-primary hover:underline">info@carmazium.com</a>.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
