import { redirect } from "next/navigation"

/** Preserve existing verification deep links without an old wizard. */
export default async function LegacyVerificationRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/partner?capability=${encodeURIComponent(id)}#provider-business`)
}
