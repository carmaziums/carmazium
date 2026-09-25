"use client"

import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { DeleteAccountSection } from "@/components/dashboard/DeleteAccountSection"

export function DeleteAccountPortal() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-sm text-[var(--text-muted)]">Checking your account…</div>
  }

  if (user) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
          <h2 className="text-xl font-black text-[var(--text-primary)]">You are signed in</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            You can delete this CarMazium account below. If you have a live auction or an active bid, deletion may be blocked until that live commitment ends.
          </p>
        </div>
        <DeleteAccountSection />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
        <h2 className="text-xl font-black text-[var(--text-primary)]">Delete an account from the web</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          Sign in to the CarMazium account you want to delete. You will return to this page and can submit the deletion directly.
        </p>
        <Link
          href="/auth/login?redirect=/delete-account"
          className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-black text-white"
        >
          Sign in to delete my account
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
        <h2 className="text-lg font-black text-[var(--text-primary)]">Cannot sign in?</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          Email us from the address connected to your CarMazium account. We may ask you to verify your identity before processing the request.
        </p>
        <a
          className="mt-4 inline-flex rounded-xl border border-[var(--border-default)] px-5 py-3 text-sm font-bold text-[var(--text-primary)]"
          href="mailto:info@carmazium.com?subject=Account%20deletion%20request"
        >
          Email account deletion request
        </a>
      </div>
    </div>
  )
}
