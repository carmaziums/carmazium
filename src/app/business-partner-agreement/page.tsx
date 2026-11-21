import type { Metadata } from "next"
import { PartnerAgreementPanel } from "@/components/legal/PartnerAgreementPanel"
export const metadata: Metadata = {
  title: "Master Business Partner Agreement | CarMazium",
  description: "Read and electronically accept CarMazium's complete business partner agreement and trading/service schedules.",
  robots: { index: false, follow: true },
}
export default function BusinessPartnerAgreementPage() {
  return <div className="min-h-screen px-4 pb-20 pt-28"><PartnerAgreementPanel/></div>
}
