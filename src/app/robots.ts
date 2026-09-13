import type { MetadataRoute } from "next"

// Canonical SEO origin. Keep this independent of the app URL environment value.
const SITE_URL = "https://www.carmazium.com"

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/admin",
                    "/api",
                    "/dashboard",
                    "/profile",
                    "/auth",
                    "/checkout",
                    "/messages",
                    "/settings",
                    "/onboarding",
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    }
}
