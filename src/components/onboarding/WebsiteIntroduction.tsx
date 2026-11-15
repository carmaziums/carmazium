"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { canAutoIntroduce, getWelcomeSteps } from "@/lib/welcomeTour"

type IntroductionAction = "tour_skipped" | "tour_completed" | "services_dismissed" | "services_viewed"
export async function saveIntroduction(action: IntroductionAction) {
    await apiClient("/users/me/introduction", { method: "PATCH", body: JSON.stringify({ action }) })
}

const IntroductionContext = createContext({ replay: () => {}, saving: false })

export function ReplayIntroduction() {
    const { replay, saving } = useContext(IntroductionContext)
    return <button type="button" disabled={saving} onClick={replay} className="min-h-11 rounded-xl border border-[var(--border-default)] px-4 py-2 font-semibold hover:border-primary disabled:opacity-50">Replay website introduction</button>
}

export function WebsiteIntroduction({ children }: { children: React.ReactNode }) {
    const { profile, user, loading, refreshProfile } = useAuth()
    const pathname = usePathname()
    const dialog = useRef<HTMLDialogElement>(null)
    const heading = useRef<HTMLHeadingElement>(null)
    const seen = useRef(new Set<string>())
    const identity = useRef<string | undefined>(undefined)
    identity.current = profile?.id
    const [openFor, setOpenFor] = useState<string | null>(null)
    const [step, setStep] = useState(0)
    const [saving, setSaving] = useState(false)
    const [failed, setFailed] = useState<{ userId: string; action: IntroductionAction } | null>(null)
    const ready = !loading && !!profile && user?.id === profile.id
    const open = ready && openFor === profile.id
    const steps = profile ? getWelcomeSteps(profile) : []

    useEffect(() => {
        if (!ready || !profile || seen.current.has(profile.id)) return
        if (canAutoIntroduce(profile, pathname, window.location.search)) {
            seen.current.add(profile.id)
            setStep(0)
            setOpenFor(profile.id)
        }
    }, [ready, profile, pathname])

    useEffect(() => {
        if (!open || !dialog.current) return
        const previousFocus = document.activeElement as HTMLElement | null
        const previousOverflow = document.body.style.overflow
        dialog.current.showModal()
        document.body.style.overflow = "hidden"
        heading.current?.focus()
        return () => {
            dialog.current?.close()
            document.body.style.overflow = previousOverflow
            if (previousFocus?.isConnected) previousFocus.focus()
        }
    }, [open])
    useEffect(() => { if (open) heading.current?.focus() }, [step, open])

    async function persist(action: IntroductionAction, userId: string) {
        if (identity.current !== userId) return
        setSaving(true)
        try {
            await saveIntroduction(action)
            if (identity.current === userId) { setFailed(null); await refreshProfile() }
        } catch {
            if (identity.current === userId) setFailed({ userId, action })
        } finally { setSaving(false) }
    }
    function finish(action: "tour_skipped" | "tour_completed") {
        if (!profile) return
        setOpenFor(null)
        void persist(action, profile.id)
    }
    function replay() {
        if (!ready || !profile || saving) return
        seen.current.add(profile.id)
        setStep(0)
        setOpenFor(profile.id)
    }

    return <IntroductionContext.Provider value={{ replay, saving }}>
        {children}
        {failed?.userId === profile?.id && failed && <div role="status" className="fixed bottom-24 left-4 right-4 z-[9999] mx-auto max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-xl">
            <p>The introduction is closed, but we could not save your choice. It may appear again when you sign in.</p>
            <button type="button" disabled={saving} onClick={() => void persist(failed.action, failed.userId)} className="min-h-11 mr-4 font-bold text-primary">{saving ? "Saving…" : "Retry saving"}</button>
            <button type="button" onClick={() => setFailed(null)} className="min-h-11 underline">Dismiss message</button>
        </div>}
        {open && steps[step] && <dialog ref={dialog} aria-labelledby="website-introduction-title" aria-describedby="website-introduction-description" onCancel={event => { event.preventDefault(); finish("tour_skipped") }} className="m-auto w-[calc(100%_-_2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/65 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-muted)]">Getting started · {step + 1} of {steps.length}</p>
                <button type="button" onClick={() => finish("tour_skipped")} className="min-h-11 shrink-0 px-3 font-semibold underline">Skip tour</button>
            </div>
            <progress aria-label="Introduction progress" value={step + 1} max={steps.length} className="mb-6 h-1.5 w-full accent-primary" />
            <h2 ref={heading} tabIndex={-1} id="website-introduction-title" className="text-2xl font-bold outline-none sm:text-3xl">{steps[step].title}</h2>
            <p id="website-introduction-description" className="mt-3 text-[var(--text-secondary)]">{steps[step].description}</p>
            <ul className="my-6 list-disc space-y-4 pl-5 text-sm leading-relaxed sm:text-base">{steps[step].points.map(point => <li key={point}>{point}</li>)}</ul>
            <div className="flex items-center justify-between gap-4 border-t border-[var(--border-default)] pt-5">
                <button type="button" disabled={step === 0} onClick={() => setStep(value => value - 1)} className="min-h-11 rounded-xl border border-[var(--border-default)] px-5 font-semibold disabled:opacity-40">Back</button>
                <button type="button" onClick={() => step === steps.length - 1 ? finish("tour_completed") : setStep(value => value + 1)} className="min-h-11 rounded-xl bg-primary px-6 font-bold text-white">{step === steps.length - 1 ? "Get started" : "Next"}</button>
            </div>
        </dialog>}
    </IntroductionContext.Provider>
}
