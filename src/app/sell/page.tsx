import { Suspense } from "react"
import { ListingWizard } from "@/components/listing/ListingWizard"

export default function SellPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ListingWizard isDashboard={false} />
        </Suspense>
    )
}
