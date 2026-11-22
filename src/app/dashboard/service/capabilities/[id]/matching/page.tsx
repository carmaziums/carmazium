import { redirect } from "next/navigation"

/** Preserve existing matching deep links without another settings page. */
export default async function LegacyMatchingRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/partner?capability=${encodeURIComponent(id)}#provider-preferences`)
}
