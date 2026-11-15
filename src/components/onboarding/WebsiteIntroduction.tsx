"use client"

import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { canAutoIntroduce } from "@/lib/welcomeTour"
import { getGuidedWebsiteSteps } from "@/lib/guidedWebsiteTour"
import { GuidedWebsiteTour } from "./GuidedWebsiteTour"

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
    const seen = useRef(new Set<string>())
    const identity = useRef<string | undefined>(undefined)
    identity.current = profile?.id
    const [openFor, setOpenFor] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [failed, setFailed] = useState<{ userId: string; action: IntroductionAction } | null>(null)
    const ready = !loading && !!profile && user?.id === profile.id
    const open = ready && openFor === profile.id
    const steps = useMemo(() => profile ? getGuidedWebsiteSteps(profile) : [], [profile])

    useEffect(() => {
        if (!ready || !profile || seen.current.has(profile.id)) return
        if (canAutoIntroduce(profile, pathname, window.location.search)) {
            seen.current.add(profile.id)
            setOpenFor(profile.id)
        }
    }, [ready, profile, pathname])

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
        setOpenFor(profile.id)
    }

    return <IntroductionContext.Provider value={{ replay, saving }}>
        {children}
        {failed?.userId === profile?.id && failed && <div role="status" className="fixed bottom-24 left-4 right-4 z-[9999] mx-auto max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] p-4 shadow-xl">
            <p>The introduction is closed, but we could not save your choice. It may appear again when you sign in.</p>
            <button type="button" disabled={saving} onClick={() => void persist(failed.action, failed.userId)} className="min-h-11 mr-4 font-bold text-primary">{saving ? "Saving…" : "Retry saving"}</button>
            <button type="button" onClick={() => setFailed(null)} className="min-h-11 underline">Dismiss message</button>
        </div>}
        {open && <Suspense fallback={null}><GuidedWebsiteTour steps={steps} finish={finish} /></Suspense>}
    </IntroductionContext.Provider>
}
