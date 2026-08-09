import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, User } from "lucide-react"
import type { BlogPost } from "@/lib/blogApi"
import { BlogContent } from "@/components/blog/BlogContent"

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const post = await getPostBySlug(slug)

    if (!post) {
        return { title: "Post Not Found", robots: { index: false, follow: false } }
    }

    const title = post.metaTitle || post.title
    const description = post.metaDescription || post.excerpt
    const url = `${SITE_URL}/blog/${post.slug}`

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            title: `${title} | CarMazium`,
            description,
            url,
            type: "article",
            publishedTime: post.publishedAt ?? undefined,
            images: post.coverImage ? [{ url: post.coverImage }] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | CarMazium`,
            description,
            images: post.coverImage ? [post.coverImage] : undefined,
        },
    }
}

function formatDate(d: string | null) {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = await getPostBySlug(slug)
    if (!post) notFound()

    const url = `${SITE_URL}/blog/${post.slug}`
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        image: post.coverImage ? [post.coverImage] : undefined,
        datePublished: post.publishedAt ?? post.createdAt,
        dateModified: post.updatedAt,
        author: { "@type": "Organization", name: post.authorName },
        publisher: { "@type": "Organization", name: "CarMazium" },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
    }

    return (
        <div className="min-h-screen pt-28 pb-24">
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <article className="container mx-auto px-5 max-w-3xl">
                <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-primary transition-colors mb-8">
                    <ArrowLeft size={14} /> Back to Blog
                </Link>

                {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag) => (
                            <span key={tag} className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <h1 className="text-3xl md:text-4xl font-black font-heading tracking-tight mb-4 leading-tight">{post.title}</h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)] mb-8 pb-8 border-b border-[var(--border-default)]">
                    <span className="flex items-center gap-1.5"><User size={13} /> {post.authorName}</span>
                    {post.publishedAt && <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(post.publishedAt)}</span>}
                </div>

                {post.coverImage && (
                    <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[var(--bg-input)]">
                        <Image src={post.coverImage} alt={post.title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" priority />
                    </div>
                )}

                <BlogContent content={post.content} />
            </article>
        </div>
    )
}
