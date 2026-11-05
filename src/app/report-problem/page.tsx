import type { Metadata } from "next"
import { ReportProblemForm } from "./ReportProblemForm"

export const metadata: Metadata = {
  title: "Report a problem",
  description: "Tell the CarMazium team about a problem with the website or app.",
  alternates: { canonical: "/report-problem" },
  robots: { index: false, follow: true },
}

export default function ReportProblemPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] pb-20 pt-28">
      <div className="mx-auto max-w-2xl px-5">
        <h1 className="text-3xl font-black tracking-tight">Report a problem</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Tell us what went wrong and we&apos;ll fix it. Your report goes straight to the CarMazium team.
        </p>
        <ReportProblemForm />
      </div>
    </main>
  )
}
