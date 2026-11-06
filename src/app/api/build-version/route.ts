import { NextResponse } from "next/server"

/**
 * Identifies the website version currently being served. The installed
 * iPhone/Windows app and open browser tabs compare it with the version they
 * started with, and offer "New version available — Update" when it changes.
 */
export const dynamic = "force-dynamic"

export function GET() {
  const version =
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "local"
  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } })
}
