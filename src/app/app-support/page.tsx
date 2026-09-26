import type { Metadata } from "next"
import Link from "next/link"
import { Mail, MapPin, Phone, ShieldCheck, Trash2 } from "lucide-react"

export const metadata: Metadata = {
  title: "CarMazium App Support",
  description: "Support, privacy and account-help information for the CarMazium iPhone and Android apps.",
}

export default function AppSupportPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] pb-16 pt-24">
      <div className="container mx-auto max-w-4xl px-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Mobile app support</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text-primary)] md:text-5xl">
          CarMazium App Support
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-[var(--text-secondary)]">
          Help for the CarMazium iPhone and Android apps, including account access, listings,
          auctions, dealer verification, payments, messages and privacy requests.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
            <Mail className="text-primary" />
            <h2 className="mt-4 text-xl font-black text-[var(--text-primary)]">Email support</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Email <a className="text-primary underline" href="mailto:info@carmazium.com">info@carmazium.com</a> for
              account, listing, auction, payment or technical help.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
            <Phone className="text-primary" />
            <h2 className="mt-4 text-xl font-black text-[var(--text-primary)]">Telephone</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              <a className="text-primary underline" href="tel:+441218385040">0121 838 5040</a><br />
              Monday to Friday, 9am–6pm (UK time).
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
            <MapPin className="text-primary" />
            <h2 className="mt-4 text-xl font-black text-[var(--text-primary)]">Business address</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              CarMazium Ltd<br />
              181–187 Hunters Road<br />
              Lozells, Birmingham B19 1ES<br />
              United Kingdom
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
            <ShieldCheck className="text-primary" />
            <h2 className="mt-4 text-xl font-black text-[var(--text-primary)]">Privacy & legal</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="text-primary underline" href="/privacy-policy">Privacy Policy</Link>
              <Link className="text-primary underline" href="/terms">Terms & Conditions</Link>
              <Link className="text-primary underline" href="/cookie-policy">Cookie Policy</Link>
            </div>
          </section>
        </div>

        <section id="accessibility" className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
          <ShieldCheck className="text-primary" />
          <h2 className="mt-4 text-xl font-black text-[var(--text-primary)]">Accessibility support</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            CarMazium is designed to work with platform accessibility settings including screen readers,
            larger text and Reduce Motion. If any control, form or flow is difficult to use with an
            accessibility feature, email <a className="text-primary underline" href="mailto:info@carmazium.com?subject=Accessibility%20support">info@carmazium.com</a> and tell us the device and feature you were using.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-red-500/25 bg-[var(--bg-card)] p-6">
          <Trash2 className="text-red-400" />
          <h2 className="mt-4 text-xl font-black text-[var(--text-primary)]">Delete your account</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Signed-in members can start deletion from Settings in the app. If you cannot sign in,
            use the public account-deletion page or contact us from the email address linked to your account.
          </p>
          <Link
            href="/delete-account"
            className="mt-4 inline-flex rounded-xl border border-red-500/30 px-4 py-2 text-sm font-bold text-red-400"
          >
            Account deletion help
          </Link>
        </section>

        <p className="mt-8 text-xs leading-5 text-[var(--text-muted)]">
          CarMazium Ltd · Company number 17053307 · Registered in England and Wales.
        </p>
      </div>
    </main>
  )
}
