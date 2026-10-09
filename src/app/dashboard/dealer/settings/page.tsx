import { redirect } from "next/navigation"

/** Legacy settings URL: all account editors now live in one location. */
export default function LegacyAccountSettingsRedirect() {
    redirect("/profile?section=business")
}
