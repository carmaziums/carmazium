import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How CarMazium collects, uses, shares, retains and protects personal data.",
}

const sections = [
  {
    title: "1. Who we are",
    body: (
      <>
        <p>CarMazium Ltd is the controller of personal data processed through CarMazium unless another party is clearly identified as the controller for a particular service.</p>
        <p>Company number: 17053307. Registered in England and Wales. Contact: <a className="text-primary underline" href="mailto:info@carmazium.com">info@carmazium.com</a>.</p>
      </>
    ),
  },
  {
    title: "2. Who can use CarMazium",
    body: <p>CarMazium accounts are for people aged 18 or over who are legally capable of entering into contracts. Business users must be authorised to act for the relevant business.</p>,
  },
  {
    title: "3. Information we collect",
    body: (
      <>
        <p>Depending on how you use CarMazium, we may process:</p>
        <ul>
          <li>account and contact information such as name, email address, telephone number, profile image and authentication identifiers;</li>
          <li>location information such as town, postcode and, only when you choose the “Locate Me” feature, device location used to determine a nearby postcode;</li>
          <li>vehicle and listing information including registration, mileage, specification, condition, photographs, videos, pricing, bids, offers, handover evidence and transaction history;</li>
          <li>business and verification information for Partner Accounts, including company or sole-trader details, address, identity evidence and documents submitted for KYC or service-provider verification;</li>
          <li>service, finance, warranty and insurance enquiry information that you choose to submit;</li>
          <li>payment and payout information. Card payments are processed by Stripe. CarMazium does not receive or store full card numbers. Bank or payout details may be stored where needed to make or administer a payout;</li>
          <li>messages, chat attachments, reports, disputes and customer-support communications;</li>
          <li>push-notification tokens and notification preferences;</li>
          <li>technical and usage information such as session identifiers, device/browser information, page or screen activity, referral information and analytics events; and</li>
          <li>MaziuM AI prompts and recent conversation context when you use the AI assistant.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Why we use personal data",
    body: (
      <>
        <p>We use personal data to operate the marketplace, create and secure accounts, publish listings, run auctions, connect buyers and sellers, administer Partner services, process CarMazium fees and incentives, provide customer support, detect fraud and misuse, verify users and businesses, send service notifications, improve the platform and comply with legal obligations.</p>
        <p>Our legal bases may include performance of a contract, steps taken at your request before entering a contract, compliance with legal obligations, our legitimate interests in operating and protecting the marketplace, and consent where consent is required.</p>
      </>
    ),
  },
  {
    title: "5. AI and third-party processors",
    body: (
      <>
        <p>CarMazium uses service providers to operate the platform. These may include Supabase for authentication and data services, Stripe for payments and payouts, Vercel and Fly.io for hosting/infrastructure, Expo for mobile push-notification infrastructure, Apple and Google for sign-in where you choose those options, and OpenAI for MaziuM AI functionality.</p>
        <p>CarMazium uses OpenAI for optional AI features including MaziuM chat, native AI Search, AI-assisted listing descriptions and, where you have consented, live vehicle-specification enrichment. Before an interactive AI prompt or seller vehicle data is sent to OpenAI, the website or native app requires an explicit acknowledgement. Core DVLA/MOT vehicle lookup remains available without AI enrichment. Do not include unnecessary sensitive personal information, passwords, payment credentials or authentication codes in AI prompts.</p>
        <p>If you use the in-app “Report AI response” feature, CarMazium stores the reported AI response, the associated prompt where available, your selected reason and any optional details so an administrator can review the report and improve safety controls. You can stop sending new prompts to OpenAI at any time through the MaziuM AI privacy controls; the assistant will ask for acknowledgement again before another prompt is sent.</p>
        <p>We may also use vehicle-data, verification, email, analytics and communications providers where needed to deliver a feature. Providers receive only the information reasonably necessary for their role and are subject to contractual or platform safeguards as applicable.</p>
      </>
    ),
  },
  {
    title: "6. Advertising, analytics and cookies",
    body: (
      <>
        <p>The website uses necessary cookies for functions such as keeping you signed in. Analytics and marketing technologies, including Google, Meta and TikTok tools where configured, are loaded only in accordance with the website consent controls.</p>
        <p>You can review or change website cookie choices through Cookie Preferences. See our <Link className="text-primary underline" href="/cookie-policy">Cookie Policy</Link> for more detail.</p>
      </>
    ),
  },
  {
    title: "7. Sharing information with other users",
    body: (
      <>
        <p>Information you intentionally publish in a vehicle listing or public profile may be visible to other users or visitors. Contact details and documents are disclosed only where the relevant product flow permits it.</p>
        <p>Private member-to-member chats are intended for the participants. A specific message and attachment may be shared with CarMazium moderators when a participant reports it, and relevant records may be reviewed when needed for a dispute, safety, fraud or legal issue.</p>
      </>
    ),
  },
  {
    title: "8. International transfers",
    body: <p>Some service providers may process data outside the United Kingdom. Where UK data-protection law requires safeguards for an international transfer, we use an appropriate transfer mechanism or rely on another lawful transfer basis.</p>,
  },
  {
    title: "9. Retention",
    body: (
      <>
        <p>We keep personal data only for as long as reasonably necessary for the purpose for which it was collected and for legal, tax, accounting, fraud-prevention, security, dispute or regulatory requirements.</p>
        <p>Successful account deletion removes the sign-in identity, sensitive KYC documents, account-owned files and transient personal records, withdraws unfinished listings and irreversibly anonymises the application account used as a reference by shared marketplace records.</p>
        <p>Completed transaction, payment, bid, offer, sale, dispute, moderation, service and transactional-chat records may be retained in pseudonymous form where they remain necessary to protect other users, administer refunds or payouts, establish or defend legal claims, prevent fraud, meet financial-record obligations or comply with law. Private chat attachments are removed. When a retention purpose expires, the remaining record should be deleted or further anonymised.</p>
      </>
    ),
  },
  {
    title: "10. Account deletion",
    body: (
      <>
        <p>You can start account deletion in the CarMazium app or website settings. You can also use the public <Link className="text-primary underline" href="/delete-account">Delete Account</Link> page without relying on the mobile app.</p>
        <p>If an account has a live auction or active bid, deletion may be delayed until that live commitment ends so deletion cannot be used to evade an active transaction. Once deletion completes, CarMazium removes the Supabase sign-in identity and the backend also blocks stale sessions or access tokens from restoring the deleted account. If you cannot sign in, contact <a className="text-primary underline" href="mailto:info@carmazium.com?subject=Account%20deletion%20request">info@carmazium.com</a> from the email address connected to the account.</p>
      </>
    ),
  },
  {
    title: "11. Your rights",
    body: (
      <>
        <p>Subject to applicable law and exemptions, you may have rights to access personal data, correct inaccurate data, request deletion, restrict or object to certain processing, receive portable data and withdraw consent where processing relies on consent.</p>
        <p>To exercise a privacy right, email <a className="text-primary underline" href="mailto:info@carmazium.com?subject=Privacy%20request">info@carmazium.com</a>. We may need to verify your identity before acting on a request.</p>
        <p>You may also raise a concern with the UK Information Commissioner’s Office if you believe your data-protection rights have been infringed.</p>
      </>
    ),
  },
  {
    title: "12. Security",
    body: <p>We use technical and organisational safeguards intended to protect personal data, including access controls, authenticated application routes, private storage for sensitive verification evidence where implemented, and encrypted network transport. No internet service can guarantee absolute security.</p>,
  },
  {
    title: "13. Changes to this policy",
    body: <p>We may update this Privacy Policy when the platform, our providers or legal requirements change. Material changes will be communicated where appropriate. The current version will always be published on this page.</p>,
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-16">
      <div className="container mx-auto max-w-4xl px-5">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="mt-2 text-4xl md:text-5xl font-black font-heading uppercase tracking-tight text-[var(--text-primary)]">Privacy Policy</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Last updated: 25 September 2026</p>
          <p className="mt-5 max-w-3xl text-[var(--text-secondary)] leading-7">
            This policy explains how CarMazium handles personal data across the website, iPhone and Android apps, marketplace, auctions, Partner services and MaziuM AI.
          </p>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
              <h2 className="text-xl font-black text-[var(--text-primary)]">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--text-secondary)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/terms" className="rounded-xl border border-[var(--border-default)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] hover:border-primary/50">Terms & Conditions</Link>
          <Link href="/cookie-policy" className="rounded-xl border border-[var(--border-default)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] hover:border-primary/50">Cookie Policy</Link>
          <Link href="/delete-account" className="rounded-xl border border-red-500/30 px-5 py-3 text-sm font-bold text-red-400 hover:bg-red-500/5">Delete Account</Link>
        </div>
      </div>
    </main>
  )
}
