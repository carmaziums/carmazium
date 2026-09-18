"use client"

import * as React from "react"
import { Loader2, MessageSquarePlus, Search, UserRound } from "lucide-react"
import { getAdminUsers } from "@/lib/adminApi"
import { createChatRoom, type ChatRoom } from "@/lib/chatApi"

type SearchMember = {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
    role: string
    deletedAt?: string | null
}

interface AdminNewConversationProps {
    onCreated: (room: ChatRoom) => void
    onCancel: () => void
}

export function AdminNewConversation({
    onCreated,
    onCancel,
}: AdminNewConversationProps) {
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<SearchMember[]>([])
    const [searching, setSearching] = React.useState(false)
    const [openingId, setOpeningId] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        const search = query.trim()
        if (search.length < 2) {
            setResults([])
            setSearching(false)
            return
        }

        let cancelled = false
        const timer = window.setTimeout(async () => {
            try {
                setSearching(true)
                setError(null)
                const response = await getAdminUsers(1, 12, search)
                const rows = Array.isArray(response?.data) ? response.data : []
                if (!cancelled) {
                    setResults(rows.filter((user: SearchMember) =>
                        user.role !== "ADMIN" && !user.deletedAt
                    ))
                }
            } catch (err: any) {
                if (!cancelled) {
                    setResults([])
                    if (err?.message !== "AUTH_REDIRECT") {
                        setError(err?.message || "Could not search members")
                    }
                }
            } finally {
                if (!cancelled) setSearching(false)
            }
        }, 250)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [query])

    const openConversation = async (member: SearchMember) => {
        if (openingId) return
        try {
            setOpeningId(member.id)
            setError(null)
            // No listingId: because the current account is ADMIN, the backend
            // creates/reuses a SUPPORT room. It can never attach this outreach
            // to a retail or auction conversation accidentally.
            const room = await createChatRoom(member.id)
            onCreated(room)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not open the support conversation")
            }
        } finally {
            setOpeningId(null)
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_35%)]">
            <div className="mx-auto max-w-2xl">
                <div className="mb-5">
                    <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                        <MessageSquarePlus size={14} /> Direct support
                    </div>
                    <h3 className="text-2xl font-black text-[var(--text-primary)]">New conversation</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Search for a member and open their official CarMazium support thread.
                    </p>
                </div>

                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
                    <label className="mb-2 block text-sm font-bold text-[var(--text-primary)]">
                        Find member
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3">
                        <Search size={17} className="shrink-0 text-[var(--text-muted)]" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            autoFocus
                            placeholder="Search name or email..."
                            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                        />
                        {searching && <Loader2 size={16} className="animate-spin text-primary" />}
                    </div>

                    {error && (
                        <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    <div className="mt-4 space-y-2">
                        {query.trim().length < 2 ? (
                            <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                                Enter at least two characters to search active members.
                            </div>
                        ) : !searching && results.length === 0 ? (
                            <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                                No active non-admin accounts matched this search.
                            </div>
                        ) : (
                            results.map((member) => {
                                const name = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || member.email
                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => openConversation(member)}
                                        disabled={!!openingId}
                                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-left transition-all hover:border-primary/40 hover:bg-[var(--bg-card-hover)] disabled:opacity-60"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <UserRound size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-black text-[var(--text-primary)]">{name}</p>
                                            <p className="truncate text-xs text-[var(--text-muted)]">{member.email}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full border border-[var(--border-default)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                                            {member.role.replaceAll("_", " ")}
                                        </span>
                                        {openingId === member.id && <Loader2 size={16} className="animate-spin text-primary" />}
                                    </button>
                                )
                            })
                        )}
                    </div>

                    <div className="mt-5 flex justify-end border-t border-[var(--border-default)] pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            Back to inbox
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
