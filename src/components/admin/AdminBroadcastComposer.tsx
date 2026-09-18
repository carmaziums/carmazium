"use client"

import * as React from "react"
import {
    AlertTriangle,
    CheckCircle2,
    FileImage,
    Loader2,
    Send,
    Upload,
    Users,
    Video,
    X,
} from "lucide-react"
import {
    previewAdminMessageAudience,
    sendAdminAudienceMessage,
    type AdminAudiencePreview,
    type AdminMessageAudience,
    type AdminMessageMediaKind,
} from "@/lib/adminApi"
import { uploadImage } from "@/lib/supabase"

type UploadedMedia = {
    url: string
    kind: AdminMessageMediaKind
    name: string
    mime: string
    size: number
}

const AUDIENCES: Array<{ value: AdminMessageAudience; label: string; description: string }> = [
    { value: "ALL", label: "Everyone", description: "Every active non-admin account" },
    { value: "ROLE", label: "Account role", description: "Everyone with one account role" },
    { value: "DEALERS", label: "Dealers", description: "All dealer accounts" },
    { value: "SERVICE_PROVIDERS", label: "Service providers", description: "All contractor/service-provider accounts" },
    { value: "DELIVERY_PROVIDERS", label: "Delivery drivers", description: "Approved delivery/recovery providers" },
    { value: "INSPECTION_PROVIDERS", label: "Inspection teams", description: "Approved vehicle inspection providers" },
    { value: "FINANCE_PROVIDERS", label: "Finance providers", description: "Finance partners and approved finance providers" },
    { value: "WARRANTY_PROVIDERS", label: "Warranty providers", description: "Approved warranty providers" },
    { value: "INSURANCE_PROVIDERS", label: "Insurance providers", description: "All insurance partner accounts" },
]

const ACCOUNT_ROLES = [
    ["BUYER", "Buyer"],
    ["SELLER", "Seller"],
    ["DEALER", "Dealer"],
    ["CONTRACTOR", "Service provider"],
    ["FINANCE_PARTNER", "Finance partner"],
    ["INSURANCE_PARTNER", "Insurance partner"],
] as const

export function AdminBroadcastComposer() {
    const [audience, setAudience] = React.useState<AdminMessageAudience>("ALL")
    const [role, setRole] = React.useState<string>("BUYER")
    const [message, setMessage] = React.useState("")
    const [media, setMedia] = React.useState<UploadedMedia | null>(null)
    const [uploading, setUploading] = React.useState(false)
    const [preview, setPreview] = React.useState<AdminAudiencePreview | null>(null)
    const [previewing, setPreviewing] = React.useState(false)
    const [previewError, setPreviewError] = React.useState<string | null>(null)
    const [confirming, setConfirming] = React.useState(false)
    const [sending, setSending] = React.useState(false)
    const [result, setResult] = React.useState<string | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const selection = React.useMemo(() => ({
        audience,
        ...(audience === "ROLE" ? { role } : {}),
    }), [audience, role])

    React.useEffect(() => {
        setConfirming(false)
        setResult(null)
        let cancelled = false
        const timer = window.setTimeout(async () => {
            try {
                setPreviewing(true)
                setPreviewError(null)
                const data = await previewAdminMessageAudience(selection)
                if (!cancelled) setPreview(data)
            } catch (error: any) {
                if (!cancelled) {
                    setPreview(null)
                    if (error?.message !== "AUTH_REDIRECT") setPreviewError(error?.message || "Could not preview audience")
                }
            } finally {
                if (!cancelled) setPreviewing(false)
            }
        }, 250)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [selection])

    const chooseAudience = (next: AdminMessageAudience) => {
        setAudience(next)
    }

    const handleFile = async (file?: File) => {
        if (!file) return
        const isImage = file.type.startsWith("image/")
        const isVideo = file.type.startsWith("video/")
        if (!isImage && !isVideo) {
            setResult("Only picture and video files can be sent.")
            return
        }

        const max = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024
        if (file.size > max) {
            setResult(isImage ? "Pictures must be 10 MB or smaller." : "Videos must be 25 MB or smaller.")
            return
        }

        try {
            setUploading(true)
            setResult(null)
            const url = await uploadImage(file, "listings", "admin-messages")
            setMedia({
                url,
                kind: isImage ? "IMAGE" : "VIDEO",
                name: file.name,
                mime: file.type,
                size: file.size,
            })
        } catch (error: any) {
            setResult(error?.message || "Upload failed")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const executeSend = async () => {
        if (!preview?.count) return
        try {
            setSending(true)
            setResult(null)
            const sent = await sendAdminAudienceMessage({
                ...selection,
                text: message.trim() || undefined,
                mediaUrl: media?.url,
                mediaKind: media?.kind,
                mediaName: media?.name,
                mediaMime: media?.mime,
                mediaSize: media?.size,
                expectedRecipientCount: preview.count,
            })
            setResult(
                sent.failed > 0
                    ? `Sent to ${sent.sent} of ${sent.requested} recipients. ${sent.failed} delivery failed.`
                    : `Message sent successfully to ${sent.sent} recipient${sent.sent === 1 ? "" : "s"}.`,
            )
            setMessage("")
            setMedia(null)
            setConfirming(false)
        } catch (error: any) {
            if (error?.message !== "AUTH_REDIRECT") setResult(error?.message || "Message could not be sent")
        } finally {
            setSending(false)
        }
    }

    const canSend = !!preview?.count && (!!message.trim() || !!media) && !uploading && !sending

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.08),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_35%)]">
            <div className="max-w-4xl mx-auto space-y-5">
                <div>
                    <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-[0.18em] mb-1">
                        <Send size={14} /> Admin broadcast
                    </div>
                    <h3 className="text-2xl font-black text-[var(--text-primary)]">Send a CarMazium message</h3>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Send text, a picture or a video to a selected audience. Use New Conversation for one member.</p>
                </div>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <Users size={18} className="text-primary" />
                        <h4 className="font-black">1. Choose recipients</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {AUDIENCES.map((item) => (
                            <button
                                type="button"
                                key={item.value}
                                onClick={() => chooseAudience(item.value)}
                                className={`text-left rounded-xl border p-3 transition-all ${audience === item.value
                                    ? "border-primary bg-primary/10 shadow-[0_8px_20px_rgba(239,68,68,0.12)]"
                                    : "border-[var(--border-default)] bg-[var(--bg-input)] hover:border-primary/40"
                                }`}
                            >
                                <p className="font-bold text-sm text-[var(--text-primary)]">{item.label}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.description}</p>
                            </button>
                        ))}
                    </div>

                    {audience === "ROLE" && (
                        <div className="mt-4">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Account role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="mt-2 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm"
                            >
                                {ACCOUNT_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)]">Recipient preview</p>
                            <p className="font-black text-lg text-[var(--text-primary)]">
                                {previewing ? "Checking…" : preview ? `${preview.count.toLocaleString()} recipient${preview.count === 1 ? "" : "s"}` : "Choose an audience"}
                            </p>
                        </div>
                        {previewing ? <Loader2 className="animate-spin text-primary" /> : preview?.count ? <CheckCircle2 className="text-emerald-500" /> : <Users className="text-[var(--text-muted)]" />}
                    </div>
                    {previewError && <p className="mt-2 text-sm text-red-500">{previewError}</p>}
                </section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5 shadow-lg">
                    <h4 className="font-black mb-3">2. Create message</h4>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={2000}
                        rows={6}
                        placeholder="Write the message members will receive from CarMazium..."
                        className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="mt-1 text-right text-[11px] text-[var(--text-muted)]">{message.length}/2000</div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />

                    {!media ? (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                            {uploading ? "Uploading…" : "Attach picture or video"}
                        </button>
                    ) : (
                        <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    {media.kind === "IMAGE" ? <FileImage size={18} className="text-blue-500 shrink-0" /> : <Video size={18} className="text-violet-500 shrink-0" />}
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate">{media.name}</p>
                                        <p className="text-xs text-[var(--text-muted)]">{(media.size / 1024 / 1024).toFixed(1)} MB</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setMedia(null)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"><X size={17} /></button>
                            </div>
                            {media.kind === "IMAGE" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={media.url} alt="Attachment preview" className="max-h-64 rounded-lg object-contain bg-black/5" />
                            ) : (
                                <video src={media.url} controls preload="metadata" className="max-h-64 w-full rounded-lg bg-black" />
                            )}
                        </div>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-2">Pictures up to 10 MB · videos up to 25 MB.</p>
                </section>

                {result && (
                    <div className={`rounded-xl border px-4 py-3 text-sm ${result.toLowerCase().includes("successfully") || result.startsWith("Sent to")
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }`}>
                        {result}
                    </div>
                )}

                {!confirming ? (
                    <button
                        type="button"
                        disabled={!canSend}
                        onClick={() => setConfirming(true)}
                        className="w-full rounded-xl bg-primary text-white px-5 py-3.5 font-black inline-flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(239,68,68,0.22)] hover:bg-primary/90 disabled:opacity-40 disabled:shadow-none"
                    >
                        <Send size={18} /> Review send to {preview?.count?.toLocaleString() || 0}
                    </button>
                ) : (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5">
                        <div className="flex gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <p className="font-black text-[var(--text-primary)]">Confirm broadcast</p>
                                <p className="text-sm text-[var(--text-muted)] mt-1">
                                    This will create a CarMazium support message for <strong>{preview?.count.toLocaleString()}</strong> recipient{preview?.count === 1 ? "" : "s"}. This action cannot be unsent from their inboxes.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                    <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 font-bold text-sm">Cancel</button>
                                    <button type="button" onClick={executeSend} disabled={sending} className="rounded-xl bg-primary text-white px-5 py-2.5 font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
                                        {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                                        {sending ? "Sending…" : `Confirm send to ${preview?.count.toLocaleString()}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
