/**
 * Anonymous app download/install counter for the admin "App downloads" figures.
 * Sends only the event name and platform — no session, account, cookie or
 * device identifier — so it needs no tracking consent.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev'

export type AppInstallPlatform = 'android' | 'ios' | 'windows'

export function countAppEvent(type: 'app_download_click' | 'app_web_installed', platform: AppInstallPlatform): void {
  try {
    const body = JSON.stringify({ type, payload: { platform } })
    const url = `${API_URL}/analytics/event`
    // keepalive lets the request finish while the download starts. (A JSON
    // sendBeacon is refused cross-origin, so it is not used here.)
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'omit', keepalive: true }).catch(() => {})
  } catch {
    // Counting must never block a download.
  }
}
