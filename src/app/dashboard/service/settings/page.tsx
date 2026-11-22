import { redirect } from "next/navigation"

/** Legacy provider settings now live in TradeXchange. */
export default function LegacyProviderSettingsRedirect() {
  redirect("/dashboard/partner#provider-business")
}
