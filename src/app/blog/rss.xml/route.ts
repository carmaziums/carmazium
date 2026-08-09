import type { BlogPost } from "@/lib/blogApi"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"

async function getLatestPosts(): Promise<BlogPost[]> {
    try {
        const res = await fetch(`${API_BASE}/blog?page=1&limit=50`, { next: { revalidate: 600 } })
        if (!res.ok) return []
        const json = await res.json()
        return json.data ?? []
    } catch {
        return []
    }
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

export async function GET() {
    const posts = await getLatestPosts()

    const items = posts
        .map((post) => {
            const url = `${SITE_URL}/blog/${post.slug}`
            const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : new Date(post.createdAt).toUTCString()
            return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(post.authorName)}</author>
      ${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("")}
    </item>`
        })
        .join("")

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>CarMazium Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Guides, market trends, and tips for buying, selling, and auctioning cars in the UK.</description>
    <language>en-gb</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600, s-maxage=600",
        },
    })
}
