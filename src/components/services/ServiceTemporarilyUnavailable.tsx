import Link from "next/link"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/Button"

export function ServiceTemporarilyUnavailable({ serviceName }: { serviceName: string }) {
    return (
        <div className="min-h-screen pt-28 pb-20 px-5" style={{ background: "var(--bg-body)" }}>
            <main className="mx-auto max-w-2xl">
                <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 md:p-10 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500">
                        <AlertTriangle size={26} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 mb-3">TradeXchange service notice</p>
                    <h1 className="text-3xl md:text-4xl font-black font-heading mb-4">{serviceName} is temporarily unavailable</h1>
                    <p className="text-sm md:text-base leading-7 text-[var(--text-muted)] mb-7">
                        CarMazium is not accepting new requests for this service right now. Existing jobs and enquiries are unaffected, and the other TradeXchange services remain available.
                    </p>
                    <Button asChild variant="outline">
                        <Link href="/services"><ArrowLeft size={15} className="mr-2" /> View available services</Link>
                    </Button>
                </div>
            </main>
        </div>
    )
}
