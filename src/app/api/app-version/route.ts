import { NextResponse } from "next/server"
import { getMobileAppLinks } from "@/lib/mobileAppDownloads"

/**
 * Latest customer Android release, read by the app's "Update available"
 * check. It is derived from the same validated settings as the /download-app
 * button (approval + checksum + carmazium.com URL), so publishing a new
 * version there automatically offers it to installed apps.
 */
export const dynamic = "force-dynamic"

export function GET() {
  const apk = getMobileAppLinks().androidApk
  const match = apk.href?.match(/-(\d+\.\d+\.\d+)-v(\d+)\.apk$/i)
  const android = apk.href && match
    ? { versionName: match[1], versionCode: Number(match[2]), url: apk.href, sha256: apk.sha256 }
    : null
  return NextResponse.json(
    { android },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  )
}
