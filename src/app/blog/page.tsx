import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, BookOpen, Calendar, Clock, Newspaper } from "lucide-react"
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
    title: "Automotive Insights, Selling Guides & Market Updates",
    description: "Independent-style car selling guides, UK market comparisons, auction advice and automotive insights from CarMazium.",
    alternates: {
        canonical: `${SITE_URL}/blog`,
        types: { "application/rss+xml": `${SITE_URL}/blog/rss.xml` },
    },
    openGraph: {
        title: "CarMazium Automotive Insights",
        description: "Car selling guides, UK market comparisons, auction advice and automotive insights.",
        url: `${SITE_URL}/blog`,
        type: "website",
        siteName: "CarMazium",
        locale: "en_GB",
    },
    twitter: {
        card: "summary_large_image",
        title: "CarMazium Automotive Insights",
        description: "Car selling guides, UK market comparisons, auction advice and automotive insights.",
    },
}

function formatDate(d: string | null) {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function readTime(content: string): number {
    const text = content
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[#>*_`~|-]/g, " ")
        .trim()
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    return Math.max(1, Math.ceil(words / 220))
}

function ArticleCard({ post }: { post: BlogPost }) {
    return (
        <Link href={`/blog/${post.slug}`} className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-primary/35 hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-black/5">
            <div className="relative aspect-video overflow-hidden bg-[var(--bg-input)]">
                {post.coverImage ? (
                    <Image src={post.coverImage} alt={post.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Newspaper className="w-10 h-10 text-[var(--text-muted)]" /></div>
                )}
            </div>
            <div className="p-5 md:p-6">
                {post.tags?.[0] && <span className="inline-flex rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-primary mb-3">{post.tags[0]}</span>}
                <h2 className="text-lg md:text-xl font-black font-heading leading-7 text-[var(--text-primary)] line-clamp-2 group-hover:text-primary transition-colors">{post.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)] line-clamp-3">{post.excerpt}</p>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--text-muted)]">
                    {post.publishedAt && <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(post.publishedAt)}</span>}
                    <span className="flex items-center gap-1.5"><Clock size={12} /> {readTime(post.content)} min</span>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-primary">Read guide <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
            </div>
        </Link>
    )
}

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const { page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)
    const { data: posts, total, totalPages } = await getPosts(page)
    const featured = page === 1 ? posts[0] : undefined
    const gridPosts = featured ? posts.slice(1) : posts

    return (
        <div className="min-h-screen pt-24 md:pt-28 pb-24">
            <div className="container mx-auto px-5 max-w-7xl">
                <section className="relative overflow-hidden rounded-3xl border border-[var(--border-default)] bg-gradient-to-br from-primary/10 via-[var(--bg-card)] to-[var(--bg-card)] px-6 py-10 md:px-10 md:py-14 mb-10 md:mb-14">
                    <div className="relative z-10 max-w-3xl">
                        <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">CarMazium Automotive Insights</p>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-heading tracking-tight leading-[1.05] text-[var(--text-primary)]">Make smarter decisions about buying and selling cars.</h1>
                        <p className="mt-5 max-w-2xl text-base md:text-lg leading-8 text-[var(--text-secondary)]">UK market comparisons, selling guides, auction advice and practical automotive research written to help you understand your options before you act.</p>
                        <div className="mt-7 flex flex-col sm:flex-row gap-3">
                            <Link href="/sell" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white hover:bg-primary/90 transition-colors">Sell My Car <ArrowRight size={15} /></Link>
                            <a href="#latest-guides" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] hover:border-primary/40 transition-colors"><BookOpen size={15} /> Browse Guides</a>
                        </div>
                    </div>
                </section>

                {posts.length === 0 ? (
                    <div className="glass-card p-12 text-center max-w-md mx-auto">
                        <Newspaper className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-4" />
                        <h2 className="text-lg font-bold mb-2">No posts yet</h2>
                        <p className="text-sm text-[var(--text-muted)]">Check back soon for new articles.</p>
                    </div>
                ) : (
                    <>
                        {featured && (
                            <section className="mb-12" aria-labelledby="featured-guide">
                                <div className="mb-5 flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-primary text-[10px] font-black uppercase tracking-[0.16em]">Featured guide</p>
                                        <h2 id="featured-guide" className="mt-1 text-2xl md:text-3xl font-black font-heading text-[var(--text-primary)]">Start with our latest research</h2>
                                    </div>
                                    <span className="hidden sm:block text-xs text-[var(--text-muted)]">{total} published guides</span>
                                </div>
                                <Link href={`/blog/${featured.slug}`} className="group grid md:grid-cols-[1.2fr_1fr] overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-primary/35 transition-all duration-300 shadow-xl shadow-black/10">
                                    <div className="relative aspect-video md:aspect-auto md:min-h-[390px] overflow-hidden bg-[var(--bg-input)]">
                                        {featured.coverImage ? (
                                            <Image src={featured.coverImage} alt={featured.title} fill sizes="(max-width: 768px) 100vw, 58vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" priority />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center"><Newspaper className="w-14 h-14 text-[var(--text-muted)]" /></div>
                                        )}
                                    </div>
                                    <div className="p-6 md:p-9 flex flex-col justify-center">
                                        {featured.tags?.[0] && <span className="self-start rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-primary mb-4">{featured.tags[0]}</span>}
                                        <h2 className="text-2xl md:text-3xl font-black font-heading leading-tight text-[var(--text-primary)] group-hover:text-primary transition-colors">{featured.title}</h2>
                                        <p className="mt-4 text-sm md:text-base leading-7 text-[var(--text-muted)] line-clamp-4">{featured.excerpt}</p>
                                        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
                                            {featured.publishedAt && <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(featured.publishedAt)}</span>}
                                            <span className="flex items-center gap-1.5"><Clock size={13} /> {readTime(featured.content)} min read</span>
                                        </div>
                                        <span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-primary">Read the full guide <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
                                    </div>
                                </Link>
                            </section>
                        )}

                        <section id="latest-guides" className="scroll-mt-28" aria-labelledby="latest-guides-heading">
                            <div className="mb-6 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.16em]">Research library</p>
                                    <h2 id="latest-guides-heading" className="mt-1 text-2xl md:text-3xl font-black font-heading text-[var(--text-primary)]">{page === 1 ? "More automotive guides" : `Automotive guides — page ${page}`}</h2>
                                </div>
                            </div>
                            {gridPosts.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-7">{gridPosts.map((post) => <ArticleCard key={post.id} post={post} />)}</div>}
                        </section>

                        <section className="mt-14 rounded-3xl border border-primary/25 bg-primary/[0.06] p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
                            <div>
                                <p className="text-primary text-[10px] font-black uppercase tracking-[0.16em]">Ready when you are</p>
                                <h2 className="mt-1 text-2xl font-black font-heading text-[var(--text-primary)]">Research the market, then sell your car your way.</h2>
                                <p className="mt-2 text-sm text-[var(--text-muted)]">Auction listing £0 or retail advertising from £1.</p>
                            </div>
                            <Link href="/sell" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-white hover:bg-primary/90 transition-colors">Start Selling <ArrowRight size={15} /></Link>
                        </section>

                        {totalPages > 1 && (
                            <nav aria-label="Blog pagination" className="flex flex-wrap justify-center items-center gap-3 mt-14">
                                {page > 1 && <Link href={`/blog?page=${page - 1}`} className="min-h-11 inline-flex items-center px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-sm font-bold hover:border-primary/40 transition-colors">Previous</Link>}
                                <span className="text-sm text-[var(--text-muted)] px-2">Page {page} of {totalPages}</span>
                                {page < totalPages && <Link href={`/blog?page=${page + 1}`} className="min-h-11 inline-flex items-center px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-sm font-bold hover:border-primary/40 transition-colors">Next</Link>}
                            </nav>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
