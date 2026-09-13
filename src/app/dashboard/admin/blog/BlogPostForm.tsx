"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Eye,
    FileText,
    Gauge,
    Image as ImageIcon,
    ImagePlus,
    Link2,
    Loader2,
    Pencil,
    Search,
    Share2,
    Tags,
    Upload,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { BlogContent } from "@/components/blog/BlogContent"
import { uploadImage } from "@/lib/supabase"
import { createBlogPost, updateBlogPost, type BlogPost, type BlogPostStatus } from "@/lib/blogApi"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"
const COVER_ASPECT = 16 / 9
const COVER_RECOMMENDED = { w: 1600, h: 900 }
const COVER_ASPECT_TOLERANCE = 0.08

function slugify(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
}

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback
}

function plainMarkdown(content: string): string {
    return content
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/<[^>]*>/g, " ")
        .replace(/[#>*_`~|-]/g, " ")
}

function countWords(content: string): number {
    const text = plainMarkdown(content).trim()
    return text ? text.split(/\s+/).filter(Boolean).length : 0
}

interface BlogPostFormProps {
    post?: BlogPost
}

export function BlogPostForm({ post }: BlogPostFormProps) {
    const router = useRouter()
    const isEdit = !!post

    const [title, setTitle] = React.useState(post?.title ?? "")
    const [slug, setSlug] = React.useState(post?.slug ?? "")
    const [slugTouched, setSlugTouched] = React.useState(isEdit)
    const [excerpt, setExcerpt] = React.useState(post?.excerpt ?? "")
    const [content, setContent] = React.useState(post?.content ?? "")
    const [coverImage, setCoverImage] = React.useState(post?.coverImage ?? "")
    const [coverSize, setCoverSize] = React.useState<{ w: number; h: number } | null>(null)
    const [authorName, setAuthorName] = React.useState(post?.authorName ?? "CarMazium Team")
    const [tagsInput, setTagsInput] = React.useState((post?.tags ?? []).join(", "))
    const [status, setStatus] = React.useState<BlogPostStatus>(post?.status ?? "DRAFT")
    const [metaTitle, setMetaTitle] = React.useState(post?.metaTitle ?? "")
    const [metaDescription, setMetaDescription] = React.useState(post?.metaDescription ?? "")
    const [noIndex, setNoIndex] = React.useState(post?.noIndex ?? false)

    const [showPreview, setShowPreview] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)
    const [contentUploading, setContentUploading] = React.useState(false)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [savedMsg, setSavedMsg] = React.useState<string | null>(null)

    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const contentFileInputRef = React.useRef<HTMLInputElement>(null)
    const contentTextareaRef = React.useRef<HTMLTextAreaElement>(null)

    React.useEffect(() => {
        if (!slugTouched) setSlug(slugify(title))
    }, [title, slugTouched])

    const tags = React.useMemo(
        () => tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
        [tagsInput],
    )
    const effectiveMetaTitle = (metaTitle.trim() || title.trim() || "Your article title").trim()
    const effectiveMetaDescription = (metaDescription.trim() || excerpt.trim() || "Add a useful meta description for this article.").trim()
    const canonicalSlug = slug.trim() || slugify(title) || "your-post-slug"
    const canonicalUrl = `${SITE_URL}/blog/${canonicalSlug}`
    const words = countWords(content)
    const minutes = Math.max(1, Math.ceil(words / 220))
    const headingCount = (content.match(/^#{2,3}\s+.+$/gm) || []).length
    const internalLinkCount = (content.match(/\]\((?:\/|https?:\/\/(?:www\.)?carmazium\.com\/)[^)]+\)/gi) || []).length
    const primaryTopic = tags[0] || ""
    const topicMentioned = primaryTopic
        ? `${title} ${excerpt} ${content}`.toLowerCase().includes(primaryTopic.toLowerCase())
        : false

    const seoChecks = [
        {
            label: "Search title is concise",
            ok: effectiveMetaTitle.length >= 30 && effectiveMetaTitle.length <= 60,
            hint: `${effectiveMetaTitle.length} characters — aim roughly for 30–60.`,
        },
        {
            label: "Meta description is useful",
            ok: effectiveMetaDescription.length >= 120 && effectiveMetaDescription.length <= 160,
            hint: `${effectiveMetaDescription.length} characters — aim roughly for 120–160.`,
        },
        { label: "16:9 cover artwork added", ok: Boolean(coverImage), hint: "Use a clear 1600×900 image with text kept away from the edges." },
        { label: "Article has useful depth", ok: words >= 600, hint: `${words.toLocaleString()} words · about ${minutes} min read.` },
        { label: "Article is structured with sections", ok: headingCount >= 3, hint: `${headingCount} H2/H3 section headings found.` },
        { label: "Internal CarMazium link included", ok: internalLinkCount >= 1, hint: `${internalLinkCount} internal link${internalLinkCount === 1 ? "" : "s"} found.` },
        { label: "Topics / search themes added", ok: tags.length >= 2, hint: tags.length ? `${tags.length} topics added. First topic is treated as the primary theme.` : "Add 2–5 specific topics." },
        { label: "Primary topic appears naturally", ok: Boolean(primaryTopic && topicMentioned), hint: primaryTopic ? `Primary topic: ${primaryTopic}` : "The first topic becomes the primary theme." },
    ]
    const seoScore = Math.round((seoChecks.filter((check) => check.ok).length / seoChecks.length) * 100)

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file.")
            return
        }
        setUploading(true)
        setError(null)
        try {
            const url = await uploadImage(file, "listings", "blog")
            setCoverSize(null)
            setCoverImage(url)
        } catch (err) {
            setError(errorMessage(err, "Upload failed"))
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleContentImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file.")
            return
        }
        setContentUploading(true)
        setError(null)
        try {
            const url = await uploadImage(file, "listings", "blog")
            const textarea = contentTextareaRef.current
            const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Article image"
            const markdown = `![${alt}](${url})`
            if (textarea) {
                const start = textarea.selectionStart
                const end = textarea.selectionEnd
                const next = content.slice(0, start) + markdown + content.slice(end)
                setContent(next)
                requestAnimationFrame(() => {
                    textarea.focus()
                    const caret = start + markdown.length
                    textarea.setSelectionRange(caret, caret)
                })
            } else {
                setContent((prev) => `${prev}\n\n${markdown}\n`)
            }
        } catch (err) {
            setError(errorMessage(err, "Upload failed"))
        } finally {
            setContentUploading(false)
            if (contentFileInputRef.current) contentFileInputRef.current.value = ""
        }
    }

    const buildPayload = (nextStatus: BlogPostStatus) => ({
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt: excerpt.trim(),
        content,
        coverImage: coverImage || undefined,
        authorName: authorName.trim() || "CarMazium Team",
        tags,
        status: nextStatus,
        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        noIndex,
    })

    const handleSave = async (nextStatus: BlogPostStatus) => {
        if (!title.trim() || !excerpt.trim() || !content.trim()) {
            setError("Title, excerpt, and content are all required.")
            return
        }
        setSaving(true)
        setError(null)
        setSavedMsg(null)
        try {
            const payload = buildPayload(nextStatus)
            if (isEdit) {
                await updateBlogPost(post!.id, payload)
                setStatus(nextStatus)
                setSavedMsg(nextStatus === "PUBLISHED" ? "Published" : "Saved as draft")
            } else {
                const created = await createBlogPost(payload)
                router.replace(`/dashboard/admin/blog/${created.id}/edit`)
                return
            }
        } catch (err) {
            setError(errorMessage(err, "Failed to save post"))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
            )}
            {savedMsg && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                    <CheckCircle2 size={16} className="shrink-0" /> {savedMsg}
                </div>
            )}

            <section className="rounded-2xl border border-[var(--border-default)] bg-gradient-to-br from-primary/10 via-[var(--bg-card)] to-[var(--bg-card)] p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div>
                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary"><Gauge size={14} /> Publishing health</p>
                        <h2 className="mt-2 text-2xl font-black font-heading text-[var(--text-primary)]">Build a post that is ready for readers and search.</h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Canonical URL, social cards, BlogPosting schema and breadcrumbs are generated automatically from the fields below.</p>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-4 text-center min-w-28">
                        <p className={`text-3xl font-black ${seoScore >= 75 ? "text-emerald-400" : seoScore >= 50 ? "text-amber-400" : "text-primary"}`}>{seoScore}%</p>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">SEO readiness</p>
                    </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 md:gap-3">
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3"><p className="text-lg font-black">{words.toLocaleString()}</p><p className="text-[10px] text-[var(--text-muted)]">Words</p></div>
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3"><p className="text-lg font-black">{minutes} min</p><p className="text-[10px] text-[var(--text-muted)]">Read time</p></div>
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3"><p className="text-lg font-black">{headingCount}</p><p className="text-[10px] text-[var(--text-muted)]">Sections</p></div>
                </div>
            </section>

            <section className="glass-card p-5 md:p-6 space-y-5">
                <div className="flex items-center gap-2"><FileText size={17} className="text-primary" /><h3 className="text-xs font-black uppercase tracking-[0.13em] text-[var(--text-primary)]">Article essentials</h3></div>
                <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Title</label>
                        <span className="text-[10px] text-[var(--text-faint)]">{title.length} characters</span>
                    </div>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How Car Auctions Help You Get the Best Price" className="text-base" />
                </div>
                <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">URL slug</label>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="hidden sm:inline text-[var(--text-muted)] shrink-0">/blog/</span>
                        <Input value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true) }} placeholder="how-car-auctions-help-you-get-the-best-price" className="text-sm" />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--text-faint)] break-all">Canonical: {canonicalUrl}</p>
                </div>
                <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Excerpt <span className="normal-case font-normal text-[var(--text-faint)]">— article cards and fallback description</span></label>
                        <span className="text-[10px] text-[var(--text-faint)]">{excerpt.length}/300</span>
                    </div>
                    <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value.slice(0, 300))} rows={3} placeholder="A useful summary that tells readers exactly what they will learn." className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm leading-6 placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none resize-none" />
                </div>
            </section>

            <section className="glass-card p-5 md:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.13em] text-[var(--text-primary)]">Cover image</h3>
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Recommended {COVER_RECOMMENDED.w}×{COVER_RECOMMENDED.h} (16:9). Keep important text and faces away from the outer edges.</p>
                    </div>
                    <ImageIcon size={18} className="text-primary shrink-0" />
                </div>

                {coverImage ? (
                    <div className="space-y-2">
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-input)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" onLoad={(e) => { const img = e.currentTarget; if (img.naturalWidth) setCoverSize({ w: img.naturalWidth, h: img.naturalHeight }) }} />
                            <span className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/70 text-white text-[9px] font-black uppercase tracking-wider">16:9 preview</span>
                            <button type="button" onClick={() => { setCoverImage(""); setCoverSize(null) }} className="absolute top-2 right-2 p-2 bg-black/65 hover:bg-black/80 rounded-xl text-white transition-colors" aria-label="Remove cover image"><X size={14} /></button>
                            {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
                        </div>
                        {coverSize && (() => {
                            const ratio = coverSize.w / coverSize.h
                            const off = Math.abs(ratio - COVER_ASPECT) / COVER_ASPECT
                            const tooNarrow = coverSize.w < 1200
                            const fits = off <= COVER_ASPECT_TOLERANCE && !tooNarrow
                            return (
                                <p className={`text-[11px] flex items-start gap-1.5 ${fits ? "text-emerald-400" : "text-amber-400"}`}>
                                    {fits ? <CheckCircle2 size={12} className="shrink-0 mt-0.5" /> : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
                                    <span>{coverSize.w}×{coverSize.h} ({ratio.toFixed(2)}:1). {fits ? "Good fit for the public article and cards." : `${off > COVER_ASPECT_TOLERANCE ? "The image will crop to 16:9. " : ""}${tooNarrow ? "A wider image will look sharper on desktop." : ""}`}</span>
                                </p>
                            )
                        })()}
                    </div>
                ) : (
                    <div className="w-full aspect-video rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                        <ImageIcon size={30} />
                        <span className="text-xs">Add a strong 16:9 editorial image</span>
                    </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
                    {uploading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Upload size={16} className="mr-2" />}
                    {uploading ? "Uploading…" : coverImage ? "Replace Image" : "Upload Image"}
                </Button>
            </section>

            <section className="glass-card p-5 md:p-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.13em] text-[var(--text-primary)]">Content (Markdown)</h3>
                        <p className="mt-1 text-[10px] text-[var(--text-faint)]">{words.toLocaleString()} words · {minutes} min read · {headingCount} sections · {internalLinkCount} internal links</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {!showPreview && <button type="button" onClick={() => contentFileInputRef.current?.click()} disabled={contentUploading} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:opacity-50">{contentUploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}{contentUploading ? "Uploading…" : "Insert Image"}</button>}
                        <button type="button" onClick={() => setShowPreview((value) => !value)} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">{showPreview ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> Preview</>}</button>
                    </div>
                </div>
                <input ref={contentFileInputRef} type="file" accept="image/*" onChange={handleContentImageSelected} className="hidden" />
                {showPreview ? (
                    <div className="min-h-[360px] border border-[var(--border-default)] rounded-2xl p-5 md:p-7 bg-[var(--bg-input)]">{content.trim() ? <BlogContent content={content} /> : <p className="text-sm text-[var(--text-muted)]">Nothing to preview yet.</p>}</div>
                ) : (
                    <textarea ref={contentTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} rows={22} placeholder={"## A clear section heading\n\nWrite useful, original content in Markdown. Add internal links such as [Sell your car](/sell), cite sources where relevant, and break long articles into H2/H3 sections.\n\nUse ‘Insert Image’ above to upload an image at the cursor."} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-3 text-sm font-mono leading-6 placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none resize-y" />
                )}
            </section>

            <section className="glass-card p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2"><Tags size={17} className="text-primary" /><h3 className="text-xs font-black uppercase tracking-[0.13em] text-[var(--text-primary)]">Editorial details</h3></div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Author</label>
                        <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="CarMazium Team" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Topics / SEO tags <span className="normal-case font-normal text-[var(--text-faint)]">— comma separated</span></label>
                        <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="sell my car, car auctions, UK car market" />
                        <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">Use 2–5 specific themes. The first tag acts as the primary topic for editorial organisation.</p>
                    </div>
                </div>
            </section>

            <section className="glass-card p-5 md:p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><Search size={17} className="text-primary" /><h3 className="text-xs font-black uppercase tracking-[0.13em] text-[var(--text-primary)]">Search & discovery</h3></div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${seoScore >= 75 ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-amber-500/25 bg-amber-500/10 text-amber-400"}`}>{seoScore}% ready</span>
                </div>

                <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Meta title <span className="normal-case font-normal text-[var(--text-faint)]">— falls back to article title</span></label>
                        <span className={`text-[10px] ${effectiveMetaTitle.length > 60 ? "text-amber-400" : "text-[var(--text-faint)]"}`}>{effectiveMetaTitle.length}/60 guide</span>
                    </div>
                    <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title || "Meta title"} />
                </div>
                <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Meta description <span className="normal-case font-normal text-[var(--text-faint)]">— falls back to excerpt</span></label>
                        <span className={`text-[10px] ${effectiveMetaDescription.length < 120 ? "text-amber-400" : "text-[var(--text-faint)]"}`}>{effectiveMetaDescription.length}/160</span>
                    </div>
                    <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))} rows={3} placeholder={excerpt || "Meta description"} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm leading-6 placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none resize-none" />
                </div>

                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]"><Link2 size={13} /> Canonical URL</p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)] break-all">{canonicalUrl}</p>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 text-sm text-[var(--text-secondary)] cursor-pointer">
                    <input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} className="accent-primary rounded w-4 h-4 mt-0.5 bg-[var(--bg-input)] border-[var(--border-default)]" />
                    <span><strong className="text-[var(--text-primary)]">Hide from search engines (noindex)</strong><br /><span className="text-xs text-[var(--text-muted)]">Use this only when you deliberately do not want Google and other search engines to index the article.</span></span>
                </label>

                <div className="grid lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[var(--border-default)] bg-white p-4 text-slate-900 overflow-hidden">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Search size={12} /> Google preview</p>
                        <p className="mt-3 text-xs text-emerald-700 truncate">carmazium.com › blog › {canonicalSlug}</p>
                        <p className="mt-1 text-[18px] leading-6 text-[#1a0dab] line-clamp-2">{effectiveMetaTitle}</p>
                        <p className="mt-1 text-[12px] leading-5 text-slate-600 line-clamp-3">{effectiveMetaDescription}</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] overflow-hidden">
                        <div className="relative aspect-[1.91/1] bg-[var(--bg-card)]">
                            {coverImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={coverImage} alt="Social card preview" className="absolute inset-0 w-full h-full object-cover" />
                            ) : <div className="absolute inset-0 flex items-center justify-center"><Share2 className="text-[var(--text-muted)]" /></div>}
                        </div>
                        <div className="p-4">
                            <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">carmazium.com</p>
                            <p className="mt-1 text-sm font-bold text-[var(--text-primary)] line-clamp-2">{effectiveMetaTitle}</p>
                            <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)] line-clamp-2">{effectiveMetaDescription}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-primary">Generated automatically when published</p>
                    <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                        {["Canonical URL", "Open Graph social metadata", "X / Twitter large image card", "BlogPosting structured data", "Breadcrumb structured data", "Author, date and topic metadata"].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {item}</span>)}
                    </div>
                </div>
            </section>

            <section className="glass-card p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2"><Gauge size={17} className="text-primary" /><h3 className="text-xs font-black uppercase tracking-[0.13em] text-[var(--text-primary)]">SEO & content checklist</h3></div>
                <div className="grid md:grid-cols-2 gap-3">
                    {seoChecks.map((check) => (
                        <div key={check.label} className={`rounded-xl border p-4 ${check.ok ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-amber-500/20 bg-amber-500/[0.05]"}`}>
                            <div className="flex items-start gap-2.5">
                                {check.ok ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />}
                                <div><p className="text-xs font-bold text-[var(--text-primary)]">{check.label}</p><p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">{check.hint}</p></div>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] leading-5 text-[var(--text-faint)]">These are publishing guidelines, not a promise of Google rankings. Quality, originality, helpfulness, links, competition and search intent still matter.</p>
            </section>

            <div className="glass-card p-4 md:p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sticky bottom-4 z-20 shadow-2xl shadow-black/20">
                <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${status === "PUBLISHED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>{status}</span>
                    <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><Clock size={11} /> {minutes} min read</span>
                </div>
                <div className="flex-1" />
                <Link href="/dashboard/admin/blog" className="text-center text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-2">Cancel</Link>
                <Button type="button" variant="outline" onClick={() => handleSave("DRAFT")} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}Save as Draft</Button>
                <Button type="button" onClick={() => handleSave("PUBLISHED")} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}{status === "PUBLISHED" ? "Save & Update" : "Publish"}</Button>
            </div>
        </div>
    )
}
