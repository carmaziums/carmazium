"use client"

import { useEffect, useRef, useState } from "react"
import { getAccessToken } from "@/lib/supabase"

/** Only the hash of public tour copy is sent. Account/profile data is never narrated. */
export function TourVoice({ text, ready }: { text: string; ready: boolean }) {
    const [enabled, setEnabled] = useState(false)
    const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle")
    const [retry, setRetry] = useState(0)
    const audio = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        const player = audio.current
        if (!player || !enabled || !ready) return
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 60_000)
        let active = true
        let objectUrl: string | undefined
        setStatus("loading")
        async function load() {
            try {
                const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
                const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
                const token = await getAccessToken()
                if (!active) return
                const base = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
                const response = await fetch(`${base}/ai/tour-narration/${key}`, {
                    signal: controller.signal, credentials: "include",
                    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                })
                if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) throw new Error("Audio unavailable")
                const blob = await response.blob()
                clearTimeout(timeout)
                if (!active) return
                objectUrl = URL.createObjectURL(blob)
                player!.src = objectUrl
                setStatus("paused")
                // Browsers that require another gesture keep the native Play control available.
                await player!.play()
            } catch {
                clearTimeout(timeout)
                if (active) setStatus("error")
            }
        }
        void load()
        return () => {
            active = false
            clearTimeout(timeout)
            controller.abort()
            player.pause()
            player.removeAttribute("src")
            player.load()
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [enabled, text, ready, retry])

    return <div className="mt-3" data-tour-narration-state={enabled ? status : "off"}>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={enabled} onChange={event => {
            if (!event.target.checked) audio.current?.pause()
            setEnabled(event.target.checked)
        }} className="h-5 w-5 accent-primary" />Voice guidance (optional)</label>
        <audio ref={audio} controls={enabled} hidden={!enabled} preload="none" aria-label="Website tour AI narration" className="h-10 w-full"
            onPlaying={() => setStatus("playing")} onPause={() => setStatus(value => value === "playing" ? "paused" : value)} onEnded={() => setStatus("paused")} onError={() => setStatus("error")} />
        {enabled && <>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Natural British-English AI narration.</p>
            <p role="status" className="mt-1 text-xs">{!ready ? "Voice will start when this page is ready." : status === "loading" ? "Preparing voice guidance…" : status === "playing" ? "Playing voice guidance." : status === "error" ? "Audio could not start. Press Play or try again. You can still follow the text." : "Use Play to listen again, or continue to the next step."}</p>
            {status === "error" && <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 text-sm font-semibold underline">Try voice again</button>}
        </>}
    </div>
}
