/**
 * Customer-facing CarMazium native app install destinations.
 * No guessed app IDs, Play search links or internal QA builds are advertised.
 * Configure approved PUBLIC installation destinations in Vercel after release.
 */
export type MobileAppDestination = {
  href: string | null
  available: boolean
}

export type MobileAppLinks = {
  ios: MobileAppDestination
  android: MobileAppDestination
  androidApk: MobileAppDestination & { sha256: string | null }
}

type AppDownloadEnv = Record<string, string | undefined>

const iosStore = (raw?: string): string | null => {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== "https:" || url.hostname !== "apps.apple.com" ||
        url.username || url.password || url.hash ||
        !/(?:^|\/)id\d{7,13}\/?$/.test(url.pathname)) return null
    return url.toString()
  } catch { return null }
}

const googlePlay = (raw?: string): string | null => {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== "https:" || url.hostname !== "play.google.com" ||
        url.pathname !== "/store/apps/details" || url.username || url.password ||
        url.hash || url.searchParams.get("id") !== "uk.carmazium.app") return null
    return url.toString()
  } catch { return null }
}

/**
 * Direct Android APK is optional. Only an owner-approved, signed RELEASE
 * artifact on CarMazium's own HTTPS domain, with a declared SHA-256, may be
 * offered. Internal Expo preview / development builds must never be linked.
 * Signing and actual content integrity MUST be separately reviewed by owner.
 */
const approvedAndroidApk = (env: AppDownloadEnv): { href: string | null; sha256: string | null } => {
  if (env.NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED !== "true") return { href: null, sha256: null }
  const hash = env.NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256?.trim()
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return { href: null, sha256: null }
  try {
    const url = new URL((env.NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL || "").trim())
    if (url.protocol !== "https:" ||
        !["carmazium.com", "www.carmazium.com"].includes(url.hostname) ||
        !url.pathname.startsWith("/downloads/") || !url.pathname.endsWith(".apk") ||
        url.search || url.hash || url.username || url.password) return { href: null, sha256: null }
    return { href: url.toString(), sha256: hash.toLowerCase() }
  } catch { return { href: null, sha256: null } }
}

export function resolveMobileAppLinks(env: AppDownloadEnv): MobileAppLinks {
  const ios = iosStore(env.NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL)
  const android = googlePlay(env.NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL)
  const apk = approvedAndroidApk(env)
  return {
    ios: { href: ios, available: Boolean(ios) },
    android: { href: android, available: Boolean(android) },
    androidApk: { href: apk.href, sha256: apk.sha256, available: Boolean(apk.href) },
  }
}

export function getMobileAppLinks(): MobileAppLinks {
  return resolveMobileAppLinks(process.env)
}
