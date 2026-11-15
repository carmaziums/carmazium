"use client"

import { useEffect, useId, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { GuidedStep } from "@/lib/guidedWebsiteTour"

type Highlight = { top: number; left: number; width: number; height: number }

export function GuidedWebsiteTour({ steps, finish }: { steps: GuidedStep[]; finish: (action: "tour_skipped" | "tour_completed") => void }) {
    const router = useRouter()
    const pathname = usePathname()
    const search = useSearchParams()
    const dialog = useRef<HTMLDialogElement>(null)
    const heading = useRef<HTMLHeadingElement>(null)
    const card = useRef<HTMLDivElement>(null)
    const maskId = useId().replace(/:/g, "")
    const [index, setIndex] = useState(0)
    const [highlight, setHighlight] = useState<Highlight | null>(null)
    const [placement, setPlacement] = useState<"top" | "bottom" | "center">("center")
    const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("ready")
    const [retry, setRetry] = useState(0)
    const [voice, setVoice] = useState(false)
    const [voiceSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window)
    const [voiceError, setVoiceError] = useState(false)
    const [narration, setNarration] = useState(0)
    const current = steps[index]
    const location = pathname + (search.toString() ? `?${search.toString()}` : "")

    useEffect(() => {
        const modal = dialog.current
        if (!modal) return
        const previousFocus = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow
        modal.showModal()
        document.body.style.overflow = "hidden"
        heading.current?.focus({ preventScroll: true })
        return () => {
            modal.close()
            document.body.style.overflow = overflow
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
        }
    }, [])

    // Never click page controls: the walkthrough only follows known, internal routes.
    function go(next: number) {
        window.speechSynthesis?.cancel()
        setHighlight(null)
        setStatus(steps[next].href ? "loading" : "ready")
        setPlacement("center")
        setIndex(next)
        if (steps[next].href) router.push(steps[next].href!, { scroll: false })
    }

    useEffect(() => {
        heading.current?.focus({ preventScroll: true })
        if (!current.target) return
        let stopped = false
        let scrolled: Element | null = null
        let frame = 0
        let targetObserver: ResizeObserver | undefined
        const matchingRoute = !current.href || location === current.href
        function measure() {
            if (stopped || !matchingRoute) return
            const target = Array.from(document.querySelectorAll<HTMLElement>(current.target!.selector)).find(element => {
                if (dialog.current?.contains(element)) return false
                const rect = element.getBoundingClientRect()
                return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden"
                    && (!current.target!.text || element.textContent?.replace(/\s+/g, " ").trim().toLowerCase() === current.target!.text.toLowerCase())
            })
            if (!target) { setHighlight(null); return }
            const panelHeight = card.current?.offsetHeight ?? 340
            // Reserve space below the highlighted option for the explanation on small screens.
            if (scrolled !== target) {
                scrolled = target
                target.scrollIntoView({ block: "start", behavior: "instant" })
                window.scrollBy({ top: -100, behavior: "instant" })
                targetObserver?.disconnect()
                targetObserver = new ResizeObserver(schedule)
                targetObserver.observe(target)
            }
            const rect = target.getBoundingClientRect()
            const viewportHeight = window.innerHeight
            const viewportWidth = document.documentElement.clientWidth
            const top = Math.max(8, rect.top - 6)
            const left = Math.max(8, rect.left - 6)
            const width = Math.max(0, Math.min(viewportWidth - 8, rect.right + 6) - left)
            const height = Math.max(0, Math.min(viewportHeight - 8, rect.bottom + 6) - top)
            if (!width || !height) { setHighlight(null); return }
            setHighlight({ top, left, width, height })
            setPlacement(rect.bottom + panelHeight + 32 < viewportHeight || rect.top < panelHeight + 32 ? "bottom" : "top")
            setStatus("ready")
        }
        function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
        const observer = new MutationObserver(schedule)
        observer.observe(document.body, { subtree: true, childList: true })
        const panelObserver = new ResizeObserver(schedule)
        if (card.current) panelObserver.observe(card.current)
        window.addEventListener("resize", schedule)
        window.addEventListener("scroll", schedule, true)
        schedule()
        const timeout = window.setTimeout(() => { if (!scrolled) { setStatus("unavailable"); setPlacement("center") } }, 10000)
        return () => {
            stopped = true
            clearTimeout(timeout)
            cancelAnimationFrame(frame)
            observer.disconnect()
            panelObserver.disconnect()
            targetObserver?.disconnect()
            window.removeEventListener("resize", schedule)
            window.removeEventListener("scroll", schedule, true)
        }
    }, [current, location, retry])

    useEffect(() => {
        if (!voiceSupported || !voice || status !== "ready") return
        const synthesis = window.speechSynthesis
        synthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(`${current.title}. ${current.description}`)
        utterance.onstart = () => setVoiceError(false)
        utterance.lang = "en-GB"
        const voices = synthesis.getVoices()
        utterance.voice = voices.find(item => item.lang === "en-GB") ?? voices.find(item => item.lang.startsWith("en")) ?? null
        utterance.onerror = event => { if (!["canceled", "interrupted"].includes(event.error)) setVoiceError(true) }
        synthesis.speak(utterance)
        return () => { utterance.onerror = null; utterance.onstart = null; synthesis.cancel() }
    }, [voiceSupported, voice, current, status, narration])

    return <dialog ref={dialog} aria-labelledby="website-introduction-title" aria-describedby="website-introduction-description" onCancel={event => { event.preventDefault(); finish("tour_skipped") }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-[var(--text-primary)] backdrop:bg-transparent">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            <defs><mask id={maskId}><rect width="100%" height="100%" fill="white" />{highlight && <rect x={highlight.left} y={highlight.top} width={highlight.width} height={highlight.height} rx="10" fill="black" />}</mask></defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,.72)" mask={`url(#${maskId})`} />
            {highlight && <rect x={highlight.left} y={highlight.top} width={highlight.width} height={highlight.height} rx="10" fill="none" stroke="#ff313a" strokeWidth="3" />}
        </svg>
        <div ref={card} className="absolute left-3 right-3 mx-auto max-h-[65dvh] max-w-xl overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] p-4 shadow-2xl sm:p-6" style={placement === "center" ? { top: "50%", transform: "translateY(-50%)", maxHeight: "90dvh" } : placement === "top" ? { top: 12 } : { bottom: 12 }}>
            <div className="flex items-center justify-between gap-3 text-sm"><p className="font-semibold">Website tour · {index + 1} of {steps.length}</p><button type="button" onClick={() => finish("tour_skipped")} className="min-h-11 px-3 font-semibold underline">Skip tour</button></div>
            <progress aria-label="Introduction progress" value={index + 1} max={steps.length} className="mb-3 h-1 w-full accent-primary" />
            <h2 ref={heading} tabIndex={-1} id="website-introduction-title" className="text-xl font-bold outline-none sm:text-2xl">{current.title}</h2>
            <p id="website-introduction-description" className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">{current.description}</p>
            {status !== "ready" && <p role="status" className="mt-2 text-sm">{status === "loading" ? "Opening this page and finding the option…" : <>This option is not visible on this page. It may need account approval or the page may not have loaded. You can continue or <button type="button" className="min-h-11 underline" onClick={() => { if (current.href) router.push(current.href, { scroll: false }); setStatus("loading"); setRetry(value => value + 1) }}>try again</button>.</>}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-3">
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={voice} disabled={!voiceSupported} onChange={event => { setVoice(event.target.checked); if (!event.target.checked) window.speechSynthesis?.cancel() }} className="h-5 w-5 accent-primary" />Voice guidance (optional)</label>
                {voice && <button type="button" onClick={() => setNarration(value => value + 1)} className="min-h-11 text-sm underline">Read this step again</button>}
            </div>
            {!voiceSupported && <p className="text-xs">Voice guidance is unavailable in this browser. All instructions remain on screen.</p>}
            {voiceError && <p role="status" className="text-xs">Audio could not start. Try “Read this step again”, or continue with the text.</p>}
            <label className="mt-1 block text-xs font-semibold" htmlFor="website-tour-topic">Jump to a topic</label>
            <select id="website-tour-topic" value={index} onChange={event => go(Number(event.target.value))} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 text-sm">{steps.map((step, position) => <option key={step.id} value={position}>{position + 1}. {step.title}</option>)}</select>
            <div className="mt-3 flex justify-between gap-3 border-t border-[var(--border-default)] pt-3"><button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="min-h-11 rounded-xl border border-[var(--border-default)] px-5 font-semibold disabled:opacity-40">Back</button><button type="button" onClick={() => index === steps.length - 1 ? finish("tour_completed") : go(index + 1)} className="min-h-11 rounded-xl bg-primary px-6 font-bold text-white">{index === 0 ? "Start tour" : index === steps.length - 1 ? "Finish tour" : "Next"}</button></div>
        </div>
    </dialog>
}
