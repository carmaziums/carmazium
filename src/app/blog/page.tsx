import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Calendar, Newspaper } from "lucide-react"
import type { BlogPost } from "@/lib/blogApi"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"
const PAGE_SIZE = 12

async function getPosts(page: number): Promise<{ data: BlogPost[]; total: number; totalPages: number }> {
    try {
        const res = await fetch(`${API_BASE}/blog?page=${page}&limit=${PAGE_SIZE}`, { next: { revalidate: 300 } })
        if (!res.ok) return { data: [], total: 0, totalPages: 1 }
        const json = await res.json()
        return { data: json.data ?? [], total: json.pagination?.total ?? 0, totalPages: json.pagination?.totalPages ?? 1 }
    } catch {
        return { data: [], total: 0, totalPages: 1 }
    }
}

export const metadata: Metadata = {
    title: "Blog — Automotive Insights & Market Updates",
    description: "Guides, market trends, and tips for buying, selling, and auctioning cars in the UK — from the CarMazium team.",
    alternates: {
        canonical: `${SITE_URL}/blog`,
        types: { "application/rss+xml": `${SITE_URL}/blog/rss.xml` },
    },
    openGraph: {
        title: "CarMazium Blog — Automotive Insights & Market Updates",
        description: "Guides, market trends, and tips for buying, selling, and auctioning cars in the UK.",
        url: `${SITE_URL}/blog`,
        type: "website",
    },
}

function formatDate(d: string | null) {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const { page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)
    const { data: posts, totalPages } = await getPosts(page)

    return (
        <div className="min-h-screen pt-28 pb-24">
            <div className="container mx-auto px-5">
                <div className="text-center mb-14 max-w-2xl mx-auto">
                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">The CarMazium Blog</p>
                    <h1 className="text-4xl md:text-5xl font-black font-heading tracking-tight mb-4">Automotive Insights &amp; Market Updates</h1>
                    <p className="text-[var(--text-muted)]">Guides, trends, and tips for buying, selling, and auctioning cars in the UK.</p>
                </div>

                {posts.length === 0 ? (
                    <div className="glass-card p-12 text-center max-w-md mx-auto">
                        <Newspaper className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-4" />
                        <h2 className="text-lg font-bold mb-2">No posts yet</h2>
                        <p className="text-sm text-[var(--text-muted)]">Check back soon for new articles.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {posts.map((post) => (
                                <Link
                                    key={post.id}
                                    href={`/blog/${post.slug}`}
                                    className="glass-card overflow-hidden group hover:border-primary/30 transition-colors block"
                                >
                                    <div className="h-48 overflow-hidden relative bg-[var(--bg-input)]">
                                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors z-10" />
                                        {post.coverImage ? (
                                            <Image
                                                src={post.coverImage}
                                                alt={post.title}
                                                width={400}
                                                height={250}
                                                sizes="(max-width: 768px) 100vw, 33vw"
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Newspaper className="w-10 h-10 text-[var(--text-muted)]" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6">
                                        {post.publishedAt && (
                                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                <Calendar size={10} /> {formatDate(post.publishedAt)}
                                            </p>
                                        )}
                                        <h2 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h2>
                                        <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{post.excerpt}</p>
                                        <span className="inline-flex items-center gap-1 text-primary text-sm font-bold group-hover:translate-x-2 transition-transform">
                                            Read More <ArrowRight className="h-4 w-4" />
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-3 mt-14">
                                {page > 1 && (
                                    <Link href={`/blog?page=${page - 1}`} className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 transition-colors">
                                        Previous
                                    </Link>
                                )}
                                <span className="text-sm text-[var(--text-muted)]">Page {page} of {totalPages}</span>
                                {page < totalPages && (
                                    <Link href={`/blog?page=${page + 1}`} className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 transition-colors">
                                        Next
                                    </Link>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
