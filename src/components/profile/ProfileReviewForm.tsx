"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Star } from "lucide-react"
import { apiClient } from "@/lib/apiClient"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"

export function ProfileReviewForm({ profileId }: { profileId: string }) {
    const router = useRouter()
    const { profile, loading } = useAuth()
    const [rating, setRating] = React.useState(5)
    const [comment, setComment] = React.useState("")
    const [busy, setBusy] = React.useState(false)
    const [message, setMessage] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    if (loading) return null
    if (profile?.id === profileId) return null
    if (!profile) {
        return (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                <p className="font-semibold">Want to leave a review?</p>
                <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
                    Sign in first. Reviews are accepted only after a completed CarMazium transaction or service interaction.
                </p>
                <Link href="/auth/login"><Button size="sm">Sign in to review</Button></Link>
            </div>
        )
    }

    const submit = async () => {
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            await apiClient(`/profiles/${profileId}/reviews`, {
                method: "POST",
                body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
            })
            setMessage("Your review has been saved.")
            setComment("")
            router.refresh()
        } catch (submitError: any) {
            setError(submitError?.message || "Could not save your review.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <h3 className="font-bold">Rate this profile</h3>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
                Only people with a completed CarMazium vehicle transaction, handover, delivery or service job can submit a review.
            </p>
            <div className="flex gap-1 mb-4" aria-label={`${rating} star rating`}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)} className="p-1" aria-label={`${star} stars`}>
                        <Star size={24} className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-[var(--text-muted)]"} />
                    </button>
                ))}
            </div>
            <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Share your experience (optional)"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-primary"
                style={{ background: "var(--bg-input)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            />
            <div className="mt-4 flex items-center gap-3">
                <Button onClick={submit} disabled={busy} size="sm">
                    {busy && <Loader2 size={15} className="animate-spin mr-2" />} Save review
                </Button>
                {message && <span className="text-sm text-emerald-500">{message}</span>}
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
    )
}
