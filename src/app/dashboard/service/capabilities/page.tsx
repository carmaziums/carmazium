import { redirect } from "next/navigation"

/** Retired provider onboarding: use one authoritative TradeXchange services section. */
export default function LegacyCapabilitiesRedirect() {
  redirect("/dashboard/partner#provider-services")
}
