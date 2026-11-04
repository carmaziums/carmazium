import type { MetadataRoute } from "next"

/**
 * Web app manifest: lets carmazium.com be installed as an app straight from
 * the browser — "Add to Home Screen" in Safari on iPhone/iPad, "Install" in
 * Edge/Chrome on Windows, Mac, ChromeOS and Android. No app store involved.
 * This installs the CarMazium website as an app; the native Android app is
 * the separate signed APK offered on /download-app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CarMazium",
    short_name: "CarMazium",
    description: "Sell your car with a free dealer auction or £1 retail listing, or buy used cars from verified UK sellers.",
    start_url: "/?source=installed-app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0A0A0C",
    theme_color: "#ED1C24",
    categories: ["shopping", "business", "lifestyle"],
    lang: "en-GB",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Buy cars", url: "/search", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Sell my car", url: "/sell", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Live auctions", url: "/auctions/browse", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
