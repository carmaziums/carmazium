import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * Send legacy classified links to their canonical retail URL before React
 * streams HTML. Streaming Server Component redirects can produce a 200 response
 * plus a client-side redirect instruction, which is weaker for indexing.
 *
 * Only this legacy detail route is intercepted. Auctions still render via
 * /vehicle/:id and the original route keeps its existing error handling when
 * the public listing API is temporarily unavailable.
 */
export async function proxy(request: NextRequest) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        return NextResponse.next()
    }

    const rawId = request.nextUrl.pathname.slice("/vehicle/".length)
    if (!rawId || rawId.includes("/")) return NextResponse.next()

    try {
        const backend = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
        const res = await fetch(
            `${backend.replace(/\/$/, "")}/listings/${encodeURIComponent(decodeURIComponent(rawId))}`,
            {
                cache: "no-store",
                headers: { accept: "application/json" },
                signal: AbortSignal.timeout(2500),
            },
        )
        if (!res.ok) return NextResponse.next()

        const body = await res.json()
        const listing = body?.data
        if (listing?.type !== "CLASSIFIED") return NextResponse.next()

        const slug = typeof listing.slug === "string" ? listing.slug.trim() : ""
        if (!slug || slug.includes("/")) return NextResponse.next()

        return NextResponse.redirect(
            new URL(`/buy-cars/${encodeURIComponent(slug)}`, "https://www.carmazium.com"),
            301,
        )
    } catch {
        // A temporary upstream outage must not make a known listing a 404.
        return NextResponse.next()
    }
}

export const config = {
    matcher: "/vehicle/:id",
}
