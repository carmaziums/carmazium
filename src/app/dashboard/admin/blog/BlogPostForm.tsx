"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Upload, Image as ImageIcon, X, Eye, Pencil, AlertCircle, CheckCircle2, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { BlogContent } from "@/components/blog/BlogContent"
import { uploadImage } from "@/lib/supabase"
import { createBlogPost, updateBlogPost, type BlogPost, type BlogPostStatus } from "@/lib/blogApi"

function slugify(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
}

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback
}

interface BlogPostFormProps {
    post?: BlogPost
}

/**
 * The blog index card renders its cover in a fixed `h-48` box with
 * `object-cover`, three across on desktop (src/app/blog/page.tsx) — roughly a
 * 2:1 letterbox. Anything materially taller than that gets centre-cropped top
 * and bottom, which is why cover artwork with text baked into it kept losing
 * its headline once published.
 *
 * Keep COVER_ASPECT in step with that card if its height or column count ever
 * changes, or this preview starts lying.
 */
const COVER_ASPECT = 2 / 1
const COVER_RECOMMENDED = { w: 1200, h: 600 }
/** Beyond this much deviation from 2:1, the crop is visible enough to warn. */
const COVER_ASPECT_TOLERANCE = 0.15

export function BlogPostForm({ post }: BlogPostFormProps) {
    const router = useRouter()
    const isEdit = !!post

    const [title, setTitle] = React.useState(post?.title ?? "")
    const [slug, setSlug] = React.useState(post?.slug ?? "")
    const [slugTouched, setSlugTouched] = React.useState(isEdit)
    const [excerpt, setExcerpt] = React.useState(post?.excerpt ?? "")
    const [content, setContent] = React.useState(post?.content ?? "")
    const [coverImage, setCoverImage] = React.useState(post?.coverImage ?? "")
    // Natural pixel size of the chosen cover, read once it loads, so the admin
    // can be told when the artwork will be cropped rather than discovering it
    // after publishing.
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

    // Keep the slug in sync with the title until the admin edits it directly
    React.useEffect(() => {
        if (!slugTouched) setSlug(slugify(title))
    }, [title, slugTouched])

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.')
            return
        }
        setUploading(true)
        setError(null)
        try {
            const url = await uploadImage(file, 'listings', 'blog')
            setCoverSize(null)
            setCoverImage(url)
        } catch (err) {
            setError(errorMessage(err, 'Upload failed'))
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    /** Uploads an in-body image and inserts `![alt](url)` markdown at the caret. */
    const handleContentImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.')
            return
        }
        setContentUploading(true)
        setError(null)
        try {
            const url = await uploadImage(file, 'listings', 'blog')
            const textarea = contentTextareaRef.current
            const markdown = `![](${url})`
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
                setContent(prev => `${prev}\n\n${markdown}\n`)
            }
        } catch (err) {
            setError(errorMessage(err, 'Upload failed'))
        } finally {
            setContentUploading(false)
            if (contentFileInputRef.current) contentFileInputRef.current.value = ''
        }
    }

    const buildPayload = (nextStatus: BlogPostStatus) => ({
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt: excerpt.trim(),
        content,
        coverImage: coverImage || undefined,
        authorName: authorName.trim() || 'CarMazium Team',
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        status: nextStatus,
        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        noIndex,
    })

    const handleSave = async (nextStatus: BlogPostStatus) => {
        if (!title.trim() || !excerpt.trim() || !content.trim()) {
            setError('Title, excerpt, and content are all required.')
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
                setSavedMsg(nextStatus === 'PUBLISHED' ? 'Published' : 'Saved as draft')
            } else {
                const created = await createBlogPost(payload)
                router.replace(`/dashboard/admin/blog/${created.id}/edit`)
                return
            }
        } catch (err) {
            setError(errorMessage(err, 'Failed to save post'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6 max-w-3xl">
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

            {/* Title & slug */}
            <div className="glass-card p-6 space-y-4">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Title</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How Car Auctions Help You Get the Best Price" className="text-base" />
                </div>
                <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Slug</label>
                    <div className="flex items-center gap-1 text-sm">
                        <span className="text-[var(--text-muted)] shrink-0">/blog/</span>
                        <Input
                            value={slug}
                            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
                            placeholder="how-car-auctions-help-you-get-the-best-price"
                            className="text-sm"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Excerpt <span className="text-[var(--text-faint)] normal-case font-normal">— shown on cards, {excerpt.length}/300</span></label>
                    <textarea
                        value={excerpt}
                        onChange={(e) => setExcerpt(e.target.value.slice(0, 300))}
                        rows={2}
                        placeholder="A quick guide to getting the most out of a live auction sale."
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none resize-none"
                    />
                </div>
            </div>

            {/* Cover image */}
            <div className="glass-card p-6 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Cover Image</h3>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Recommended {COVER_RECOMMENDED.w}&times;{COVER_RECOMMENDED.h} (2:1). The blog card crops to
                    this shape, so keep any text in the artwork well inside the frame.
                </p>

                {coverImage ? (
                    <div className="space-y-2">
                        {/* Exactly how the blog index will render it: same 2:1 box,
                            same object-cover. Previewing the raw upload instead —
                            which is what this used to do — hid the crop that was
                            slicing headlines off published covers. */}
                        <div
                            className="relative w-full rounded-xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-input)]"
                            style={{ aspectRatio: String(COVER_ASPECT) }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={coverImage}
                                alt="Cover preview as it will appear on the blog card"
                                className="w-full h-full object-cover"
                                onLoad={(e) => {
                                    const img = e.currentTarget
                                    if (img.naturalWidth) setCoverSize({ w: img.naturalWidth, h: img.naturalHeight })
                                }}
                            />
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold uppercase tracking-wider">
                                Card preview
                            </span>
                            <button
                                type="button"
                                onClick={() => { setCoverImage(""); setCoverSize(null) }}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                            {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
                        </div>

                        {coverSize && (() => {
                            const ratio = coverSize.w / coverSize.h
                            const off = Math.abs(ratio - COVER_ASPECT) / COVER_ASPECT
                            const tooNarrow = coverSize.w < COVER_RECOMMENDED.w
                            if (off <= COVER_ASPECT_TOLERANCE && !tooNarrow) {
                                return (
                                    <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                                        <CheckCircle2 size={12} className="shrink-0" />
                                        {coverSize.w}&times;{coverSize.h} ({ratio.toFixed(2)}:1) — fits the card with little or no cropping.
                                    </p>
                                )
                            }
                            return (
                                <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
                                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                    <span>
                                        {coverSize.w}&times;{coverSize.h} ({ratio.toFixed(2)}:1).
                                        {off > COVER_ASPECT_TOLERANCE && (
                                            ratio < COVER_ASPECT
                                                ? ' Taller than 2:1 — the top and bottom will be cropped off, as shown above.'
                                                : ' Wider than 2:1 — the sides will be cropped off, as shown above.'
                                        )}
                                        {tooNarrow && ` Also under ${COVER_RECOMMENDED.w}px wide, so it will look soft on large screens.`}
                                    </span>
                                </p>
                            )
                        })()}
                    </div>
                ) : (
                    <div
                        className="w-full rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] flex items-center justify-center"
                        style={{ aspectRatio: String(COVER_ASPECT) }}
                    >
                        <ImageIcon className="text-[var(--text-muted)]" size={28} />
                    </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
                    {uploading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Upload size={16} className="mr-2" />}
                    {uploading ? 'Uploading…' : coverImage ? 'Replace Image' : 'Upload Image'}
                </Button>
            </div>

            {/* Content */}
            <div className="glass-card p-6 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Content (Markdown)</h3>
                    <div className="flex items-center gap-4">
                        {!showPreview && (
                            <button
                                type="button"
                                onClick={() => contentFileInputRef.current?.click()}
                                disabled={contentUploading}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:opacity-50"
                            >
                                {contentUploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                                {contentUploading ? 'Uploading…' : 'Insert Image'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowPreview(v => !v)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                        >
                            {showPreview ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
                        </button>
                    </div>
                </div>
                <input ref={contentFileInputRef} type="file" accept="image/*" onChange={handleContentImageSelected} className="hidden" />
                {showPreview ? (
                    <div className="min-h-[300px] border border-[var(--border-default)] rounded-lg p-4 bg-[var(--bg-input)]">
                        {content.trim() ? <BlogContent content={content} /> : <p className="text-sm text-[var(--text-muted)]">Nothing to preview yet.</p>}
                    </div>
                ) : (
                    <textarea
                        ref={contentTextareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={16}
                        placeholder={"## A heading\n\nWrite your post in Markdown — **bold**, *italic*, [links](https://example.com), lists, images, etc.\n\nUse \"Insert Image\" above to upload and drop one in at the cursor."}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-3 text-sm font-mono placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none resize-y"
                    />
                )}
            </div>

            {/* Meta */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Details</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Author</label>
                        <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="CarMazium Team" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Tags <span className="text-[var(--text-faint)] normal-case font-normal">— comma separated</span></label>
                        <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="auctions, selling tips" />
                    </div>
                </div>
            </div>

            {/* SEO */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">SEO</h3>
                <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Meta Title <span className="text-[var(--text-faint)] normal-case font-normal">— falls back to Title</span></label>
                    <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title || "Meta title"} />
                </div>
                <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Meta Description <span className="text-[var(--text-faint)] normal-case font-normal">— falls back to Excerpt</span></label>
                    <textarea
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
                        rows={2}
                        placeholder={excerpt || "Meta description"}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none resize-none"
                    />
                    <p className="text-[10px] text-[var(--text-faint)] mt-1">{metaDescription.length}/160</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={noIndex}
                        onChange={(e) => setNoIndex(e.target.checked)}
                        className="accent-primary rounded w-4 h-4 bg-[var(--bg-input)] border-[var(--border-default)]"
                    />
                    Hide from search engines (noindex) <span className="text-[var(--text-faint)]">— post stays live at its URL, just excluded from Google</span>
                </label>
            </div>

            {/* Actions */}
            <div className="glass-card p-6 flex flex-col sm:flex-row items-center gap-3 sticky bottom-4">
                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {status}
                </span>
                <div className="flex-1" />
                <Link href="/dashboard/admin/blog" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Cancel</Link>
                <Button type="button" variant="outline" onClick={() => handleSave('DRAFT')} disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                    Save as Draft
                </Button>
                <Button type="button" onClick={() => handleSave('PUBLISHED')} disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                    {status === 'PUBLISHED' ? 'Save & Update' : 'Publish'}
                </Button>
            </div>
        </div>
    )
}
