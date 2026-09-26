import type { Metadata } from "next"
import Link from "next/link"
import { DeleteAccountPortal } from "@/components/account/DeleteAccountPortal"

export const metadata: Metadata = {
  title: "Delete Account",
  description: "Delete or request deletion of a CarMazium account and associated personal data.",
}

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-16">
      <div className="container mx-auto max-w-3xl px-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Account & privacy</p>
        <h1 className="mt-2 text-4xl md:text-5xl font-black font-heading uppercase tracking-tight text-[var(--text-primary)]">Delete Account</h1>
        <p className="mt-4 mb-8 text-sm leading-7 text-[var(--text-secondary)]">
          Account deletion is permanent. Your sign-in identity is removed, eligible active listings are withdrawn, sensitive KYC/account files are erased and the remaining application account is irreversibly anonymised. Some completed transaction, payment, bid, sale, dispute, moderation or other audit records may be retained in pseudonymous form where legally or operationally necessary, as explained in our <Link href="/privacy-policy" className="text-primary underline">Privacy Policy</Link>.
        </p>
        <DeleteAccountPortal />
      </div>
    </main>
  )
}
