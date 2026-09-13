import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, BookOpen, Calendar, Clock, Gavel, Search, User } from "lucide-react"
import type { BlogPost } from "@/lib/blogApi"
import type { Listing } from "@/lib/listingApi"
import { formatPrice } from "@/lib/listingApi"
import { BlogContent, blogHeadingId } from "@/components/blog/BlogContent"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"

async function getPostBySlug(slug: string): Promise<BlogPost | null> {
    try {
        const res = await fetch(`${API_BASE}/blog/${slug}`, { next: { revalidate: 300 } })
        if (!res.ok) return null
        const json = await res.json()
        return json.data ?? null
    } catch {
        return null
    }
}

async function getRelatedPosts(slug: string): Promise<BlogPost[]> {
    try {
        const res = await fetch(`${API_BASE}/blog/${slug}/related`, { next: { revalidate: 300 } })
        if (!res.ok) return []
        const json = await res.json()
        return json.data ?? []
    } catch {
        return []
    }
}

async function getFeaturedListings(): Promise<Listing[]> {
    try {
        const res = await fetch(`${API_BASE}/listings/featured`, { next: { revalidate: 300 } })
        if (!res.ok) return []
        const json = await res.json()
        return (json.data ?? []).slice(0, 3)
    } catch {
        return []
    }
}

function absoluteUrl(value: string | null | undefined): string | undefined {
    if (!value) return undefined
    try {
        return new URL(value, SITE_URL).toString()
    } catch {
        return value
    }
}

function formatDate(d: string | null | undefined) {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function plainMarkdown(content: string): string {
    return content
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/<[^>]*>/g, " ")
        .replace(/[#>*_`~|-]/g, " ")
}

function wordCount(content: string): number {
    const text = plainMarkdown(content).trim()
    return text ? text.split(/\s+/).filter(Boolean).length : 0
}

function readTime(content: string): number {
    return Math.max(1, Math.ceil(wordCount(content) / 220))
}

function cleanHeading(value: string): string {
    return value
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .replace(/\s+#+\s*$/, "")
        .trim()
}

function extractHeadings(content: string): Array<{ level: 2 | 3; text: string; id: string }> {
    return content.split("\n").flatMap((line) => {
        const match = line.match(/^(#{2,3})\s+(.+)$/)
        if (!match) return []
        const text = cleanHeading(match[2])
        if (!text) return []
        return [{ level: match[1].length as 2 | 3, text, id: blogHeadingId(text) }]
    })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const post = await getPostBySlug(slug)

    if (!post) {
        return { title: "Post Not Found", robots: { index: false, follow: false } }
    }

    const title = post.metaTitle || post.title
    const description = post.metaDescription || post.excerpt
    const url = `${SITE_URL}/blog/${post.slug}`
    const cover = absoluteUrl(post.coverImage)

    return {
        title,
        description,
        authors: [{ name: post.authorName }],
        keywords: post.tags,
        alternates: { canonical: url },
        robots: { index: !post.noIndex, follow: true },
        openGraph: {
            title: `${title} | CarMazium`,
            description,
            url,
            type: "article",
            locale: "en_GB",
            siteName: "CarMazium",
            publishedTime: post.publishedAt ?? undefined,
            modifiedTime: post.updatedAt,
            authors: [post.authorName],
            tags: post.tags,
            images: cover ? [{ url: cover, alt: post.title }] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | CarMazium`,
            description,
            images: cover ? [cover] : undefined,
        },
    }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = await getPostBySlug(slug)
    if (!post) notFound()

    const [relatedPosts, featuredListings] = await Promise.all([
        getRelatedPosts(slug),
        getFeaturedListings(),
    ])

    const url = `${SITE_URL}/blog/${post.slug}`
    const cover = absoluteUrl(post.coverImage)
    const headings = extractHeadings(post.content)
    const words = wordCount(post.content)
    const minutes = readTime(post.content)
    const tags = post.tags ?? []
    const updatedAfterPublish = Boolean(
        post.publishedAt && new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > 24 * 60 * 60 * 1000,
    )

    const blogPostingJsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.metaDescription || post.excerpt,
        image: cover ? [cover] : undefined,
        datePublished: post.publishedAt ?? post.createdAt,
        dateModified: post.updatedAt,
        author: { "@type": "Organization", name: post.authorName },
        publisher: { "@type": "Organization", name: "CarMazium", url: SITE_URL },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        keywords: tags.join(", ") || undefined,
        wordCount: words,
        isAccessibleForFree: true,
        inLanguage: "en-GB",
    }

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Automotive Insights", item: `${SITE_URL}/blog` },
            { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
    }

    return (
        <div className="min-h-screen pt-24 md:pt-28 pb-24">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

            <article>
                <header className="container mx-auto px-5 max-w-6xl">
                    <nav aria-label="Breadcrumb" className="mb-7 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <Link href="/blog" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                            <ArrowLeft size={14} /> Automotive Insights
                        </Link>
                        <span aria-hidden="true">/</span>
                        <span className="truncate max-w-[55vw]">{post.title}</span>
                    </nav>

                    <div className="max-w-4xl">
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-5">
                                {tags.slice(0, 4).map((tag) => (
                                    <Link
                                        key={tag}
                                        href={`/blog/tag/${encodeURIComponent(tag)}`}
                                        className="text-[10px] font-black uppercase tracking-[0.14em] text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/15 transition-colors"
                                    >
                                        {tag}
                                    </Link>
                                ))}
                            </div>
                        )}

                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-black font-heading tracking-tight leading-[1.06] text-[var(--text-primary)]">
                            {post.title}
                        </h1>
                        <p className="mt-5 text-lg md:text-xl leading-8 text-[var(--text-secondary)] max-w-3xl">
                            {post.excerpt}
                        </p>

                        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--text-muted)]">
                            <span className="flex items-center gap-1.5"><User size={14} /> {post.authorName}</span>
                            {post.publishedAt && <span className="flex items-center gap-1.5"><Calendar size={14} /> {formatDate(post.publishedAt)}</span>}
                            <span className="flex items-center gap-1.5"><Clock size={14} /> {minutes} min read</span>
                            {updatedAfterPublish && <span>Updated {formatDate(post.updatedAt)}</span>}
                        </div>
                    </div>

                    {cover && (
                        <div className="relative w-full aspect-video rounded-2xl md:rounded-[2rem] overflow-hidden mt-9 bg-[var(--bg-input)] border border-[var(--border-default)] shadow-2xl shadow-black/10">
                            <Image src={cover} alt={post.title} fill sizes="(max-width: 1200px) 100vw, 1150px" className="object-cover" priority />
                        </div>
                    )}
                </header>

                <div className="container mx-auto px-5 max-w-6xl mt-10 md:mt-14 grid lg:grid-cols-[minmax(0,760px)_280px] gap-10 lg:gap-14 items-start">
                    <main className="min-w-0">
                        {headings.length > 2 && (
                            <details className="lg:hidden mb-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                <summary className="cursor-pointer list-none flex items-center gap-2 font-bold text-sm text-[var(--text-primary)]">
                                    <BookOpen size={16} className="text-primary" /> In this article
                                </summary>
                                <nav className="mt-4 space-y-2.5 border-t border-[var(--border-default)] pt-4">
                                    {headings.map((heading) => (
                                        <a key={`${heading.id}-${heading.level}`} href={`#${heading.id}`} className={`block text-sm hover:text-primary transition-colors ${heading.level === 3 ? "pl-4 text-[var(--text-muted)]" : "font-semibold text-[var(--text-secondary)]"}`}>
                                            {heading.text}
                                        </a>
                                    ))}
                                </nav>
                            </details>
                        )}

                        <BlogContent content={post.content} />

                        <section className="mt-14 relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-[var(--bg-card)] to-[var(--bg-card)] p-6 md:p-8">
                            <div className="relative z-10 max-w-2xl">
                                <p className="text-primary text-[10px] font-black uppercase tracking-[0.18em] mb-2">Sell your car your way</p>
                                <h2 className="text-2xl md:text-3xl font-black font-heading text-[var(--text-primary)] leading-tight">Ready to turn your research into a real sale?</h2>
                                <p className="mt-3 text-sm md:text-base leading-7 text-[var(--text-secondary)]">
                                    List in the CarMazium dealer auction for £0, or advertise retail from £1. Qualifying successful auction sales can receive a £100 seller incentive.
                                </p>
                                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                    <Link href="/sell" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white hover:bg-primary/90 transition-colors">
                                        Sell My Car <ArrowRight size={15} />
                                    </Link>
                                    <Link href="/auctions/browse" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] hover:border-primary/40 transition-colors">
                                        <Gavel size={15} /> Browse Auctions
                                    </Link>
                                </div>
                            </div>
                        </section>

                        {tags.length > 0 && (
                            <div className="mt-10 pt-8 border-t border-[var(--border-default)]">
                                <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">Topics</p>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <Link key={tag} href={`/blog/tag/${encodeURIComponent(tag)}`} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-primary/40 hover:text-primary transition-colors">
                                            {tag}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </main>

                    <aside className="hidden lg:block sticky top-28 space-y-5">
                        {headings.length > 2 && (
                            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                                    <BookOpen size={15} className="text-primary" /> In this article
                                </p>
                                <nav className="mt-4 space-y-2.5 border-t border-[var(--border-default)] pt-4 max-h-[52vh] overflow-y-auto pr-1">
                                    {headings.map((heading) => (
                                        <a key={`${heading.id}-${heading.level}`} href={`#${heading.id}`} className={`block text-xs leading-5 hover:text-primary transition-colors ${heading.level === 3 ? "pl-3 text-[var(--text-muted)]" : "font-semibold text-[var(--text-secondary)]"}`}>
                                            {heading.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        )}

                        <div className="rounded-2xl border border-primary/25 bg-primary/[0.07] p-5">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">CarMazium selling</p>
                            <p className="mt-2 text-lg font-black font-heading text-[var(--text-primary)]">Auction £0. Retail from £1.</p>
                            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Verified dealers can compete for auction stock, while retail gives you a direct advertising route.</p>
                            <Link href="/sell" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:bg-primary/90 transition-colors">
                                Start Selling <ArrowRight size={14} />
                            </Link>
                        </div>
                    </aside>
                </div>

                <div className="container mx-auto px-5 max-w-6xl mt-16 md:mt-20">
                    {relatedPosts.length > 0 && (
                        <section className="pt-10 border-t border-[var(--border-default)]">
                            <div className="flex items-end justify-between gap-4 mb-6">
                                <div>
                                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.16em]">Keep reading</p>
                                    <h2 className="mt-1 text-2xl font-black font-heading text-[var(--text-primary)]">Related automotive guides</h2>
                                </div>
                                <Link href="/blog" className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">All articles <ArrowRight size={14} /></Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {relatedPosts.slice(0, 3).map((related) => (
                                    <Link key={related.id} href={`/blog/${related.slug}`} className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-primary/35 hover:-translate-y-1 transition-all duration-300">
                                        <div className="relative aspect-video overflow-hidden bg-[var(--bg-input)]">
                                            {related.coverImage ? (
                                                <Image src={related.coverImage} alt={related.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center"><BookOpen className="text-[var(--text-muted)]" /></div>
                                            )}
                                        </div>
                                        <div className="p-5">
                                            <p className="text-sm font-black leading-6 text-[var(--text-primary)] line-clamp-2 group-hover:text-primary transition-colors">{related.title}</p>
                                            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)] line-clamp-2">{related.excerpt}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {featuredListings.length > 0 && (
                        <section className="mt-14">
                            <div className="flex items-end justify-between gap-4 mb-6">
                                <div>
                                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.16em]">From the marketplace</p>
                                    <h2 className="mt-1 text-2xl font-black font-heading text-[var(--text-primary)]">Cars you might like</h2>
                                </div>
                                <Link href="/search" className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">Browse cars <Search size={14} /></Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {featuredListings.map((listing) => (
                                    <Link key={listing.id} href={`/buy-cars/${listing.slug}`} className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-primary/35 transition-colors">
                                        <div className="relative aspect-video overflow-hidden bg-[var(--bg-input)]">
                                            {listing.images?.[0] && <Image src={listing.images[0]} alt={listing.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
                                        </div>
                                        <div className="p-5">
                                            <p className="text-sm font-black truncate group-hover:text-primary transition-colors">{listing.title}</p>
                                            <p className="text-sm font-bold text-[var(--text-secondary)] mt-1">{formatPrice(listing.price)}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </article>
        </div>
    )
}
