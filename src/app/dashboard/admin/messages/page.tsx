"use client"

import * as React from "react"
import {
    Archive,
    Clock3,
    History,
    Inbox,
    MessageSquare,
    MessageSquarePlus,
    Radio,
    Flag,
    ShieldAlert,
    UserCheck,
    UserMinus,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { ChatRoomList } from "@/components/chat/ChatRoomList"
import { AdminBroadcastComposer } from "@/components/admin/AdminBroadcastComposer"
import { AdminBroadcastHistory } from "@/components/admin/AdminBroadcastHistory"
import { AdminDisputeQueue } from "@/components/admin/AdminDisputeQueue"
import { AdminChatModerationQueue } from "@/components/admin/AdminChatModerationQueue"
import { AdminNewConversation } from "@/components/admin/AdminNewConversation"
import { AdminSupportPanel } from "@/components/admin/AdminSupportPanel"
import dynamic from "next/dynamic"
const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow").then(mod => mod.ChatWindow), { ssr: false })
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { useSearchParams, useRouter } from "next/navigation"
import type { ChatRoom } from "@/lib/chatApi"

type AdminMessageMode = "inbox" | "disputes" | "moderation" | "new" | "broadcast" | "history"
type SupportFilter = "all" | "needs" | "mine" | "unassigned" | "closed"

function AdminMessagesContent() {
    const { user, profile, loading } = useAuth()
    const { rooms, refreshRooms } = useChat()
    const searchParams = useSearchParams()
    const router = useRouter()
    const targetRoomId = searchParams.get("room")
    const targetMode = searchParams.get("mode")
    const [selectedRoom, setSelectedRoom] = React.useState<ChatRoom | null>(null)
    const [mode, setMode] = React.useState<AdminMessageMode>(
        targetMode === "disputes"
            ? "disputes"
            : targetMode === "moderation"
                ? "moderation"
                : "inbox",
    )
    const [supportFilter, setSupportFilter] = React.useState<SupportFilter>("all")
    const autoSelectedRef = React.useRef(false)

    React.useEffect(() => {
        if (loading) return
        if (!user) { router.replace("/auth/login"); return }
        if (profile?.role !== "ADMIN") { router.replace("/dashboard"); return }
    }, [user, profile, loading, router])

    React.useEffect(() => {
        if (!user) return
        refreshRooms()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    React.useEffect(() => {
        if (!targetRoomId || autoSelectedRef.current) return
        const match = rooms.find(room => room.id === targetRoomId)
        if (match) {
            setMode("inbox")
            setSelectedRoom(match)
            autoSelectedRef.current = true
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, targetRoomId])

    React.useEffect(() => {
        if (!selectedRoom) return
        const fresh = rooms.find(room => room.id === selectedRoom.id)
        if (fresh) setSelectedRoom(fresh)
        // Only react to a refreshed room collection or selected ID change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, selectedRoom?.id])

    const filteredRooms = React.useMemo(() => {
        if (!user) return rooms
        switch (supportFilter) {
            case "needs":
                return rooms.filter(room => room.context === "SUPPORT" && room.needsReply && !room.supportClosedAt)
            case "mine":
                return rooms.filter(room => room.context === "SUPPORT" && room.supportAssignedAdminId === user.id && !room.supportClosedAt)
            case "unassigned":
                return rooms.filter(room => room.context === "SUPPORT" && !room.supportAssignedAdminId && !room.supportClosedAt)
            case "closed":
                return rooms.filter(room => room.context === "SUPPORT" && !!room.supportClosedAt)
            default:
                return rooms
        }
    }, [rooms, supportFilter, user])

    const filterCounts = React.useMemo(() => ({
        all: rooms.length,
        needs: rooms.filter(room => room.context === "SUPPORT" && room.needsReply && !room.supportClosedAt).length,
        mine: user ? rooms.filter(room => room.context === "SUPPORT" && room.supportAssignedAdminId === user.id && !room.supportClosedAt).length : 0,
        unassigned: rooms.filter(room => room.context === "SUPPORT" && !room.supportAssignedAdminId && !room.supportClosedAt).length,
        closed: rooms.filter(room => room.context === "SUPPORT" && !!room.supportClosedAt).length,
    }), [rooms, user])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!user || profile?.role !== "ADMIN") return null

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user.email?.split("@")[0] || "Admin")

    const filters: Array<{ value: SupportFilter; label: string; icon: React.ReactNode; count: number }> = [
        { value: "all", label: "All", icon: <Inbox size={12} />, count: filterCounts.all },
        { value: "needs", label: "Needs reply", icon: <Clock3 size={12} />, count: filterCounts.needs },
        { value: "mine", label: "Mine", icon: <UserCheck size={12} />, count: filterCounts.mine },
        { value: "unassigned", label: "Unassigned", icon: <UserMinus size={12} />, count: filterCounts.unassigned },
        { value: "closed", label: "Closed", icon: <Archive size={12} />, count: filterCounts.closed },
    ]

    return (
        <div className="min-h-screen pt-20 pb-24 lg:pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Admin Account" />

                <main className="flex-1 min-w-0">
                    <div className="glass-card flex h-[calc(100dvh-180px)] min-h-0 flex-col overflow-hidden lg:h-[calc(100vh-180px)] lg:min-h-[620px]">
                        <div className="shrink-0 p-4 sm:p-6 border-b border-[var(--border-default)] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <MessageSquare className="text-primary shrink-0" />
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold font-heading">Admin Messages</h2>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                                        Multi-agent support, internal operations and secure broadcasts
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setMode("inbox")}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${mode === "inbox" ? "bg-primary text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                >
                                    <MessageSquare size={15} /> Inbox
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode("new")
                                        setSelectedRoom(null)
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${mode === "new" ? "bg-primary text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                >
                                    <MessageSquarePlus size={15} /> New Conversation
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode("broadcast")
                                        setSelectedRoom(null)
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${mode === "broadcast" ? "bg-primary text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                >
                                    <Radio size={15} /> Broadcast
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode("disputes")
                                        setSelectedRoom(null)
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${mode === "disputes" ? "bg-primary text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                >
                                    <ShieldAlert size={15} /> Disputes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode("moderation")
                                        setSelectedRoom(null)
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${mode === "moderation" ? "bg-primary text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                >
                                    <Flag size={15} /> Moderation
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode("history")
                                        setSelectedRoom(null)
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${mode === "history" ? "bg-primary text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                >
                                    <History size={15} /> History
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1">
                            {mode === "broadcast" ? (
                                <AdminBroadcastComposer />
                            ) : mode === "history" ? (
                                <AdminBroadcastHistory />
                            ) : mode === "disputes" ? (
                                <AdminDisputeQueue
                                    currentAdminId={user.id}
                                    onOpenRoom={(room) => {
                                        setSelectedRoom(room)
                                        setMode("inbox")
                                        refreshRooms()
                                    }}
                                />
                            ) : mode === "moderation" ? (
                                <AdminChatModerationQueue currentAdminId={user.id} />
                            ) : mode === "new" ? (
                                <AdminNewConversation
                                    onCancel={() => setMode("inbox")}
                                    onCreated={(room) => {
                                        setSelectedRoom(room)
                                        setMode("inbox")
                                        refreshRooms()
                                    }}
                                />
                            ) : (
                                <div className="flex h-full min-h-0">
                                    <div className={`w-full lg:w-[360px] border-r border-[var(--border-default)] ${selectedRoom ? "hidden lg:flex lg:flex-col" : "flex flex-col"}`}>
                                        <div className="flex flex-wrap gap-1.5 border-b border-[var(--border-default)] p-3">
                                            {filters.map(filter => (
                                                <button
                                                    key={filter.value}
                                                    type="button"
                                                    onClick={() => setSupportFilter(filter.value)}
                                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black transition-colors ${supportFilter === filter.value
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                                    }`}
                                                >
                                                    {filter.icon}
                                                    {filter.label}
                                                    <span className="tabular-nums">{filter.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="min-h-0 flex-1">
                                            <ChatRoomList
                                                onSelectRoom={setSelectedRoom}
                                                selectedRoomId={selectedRoom?.id}
                                                roomsOverride={filteredRooms}
                                                showSupportOps
                                            />
                                        </div>
                                    </div>

                                    <div className={`flex min-h-0 min-w-0 flex-1 ${!selectedRoom ? "hidden lg:flex lg:items-center lg:justify-center" : ""}`}>
                                        {selectedRoom ? (
                                            <div className="flex h-full min-h-0 min-w-0 flex-1">
                                                <div className="min-h-0 min-w-0 flex-1">
                                                    <ChatWindow
                                                        room={selectedRoom}
                                                        onBack={() => setSelectedRoom(null)}
                                                    />
                                                </div>
                                                {selectedRoom.context === "SUPPORT" && (
                                                    <div className="hidden xl:block">
                                                        <AdminSupportPanel
                                                            room={selectedRoom}
                                                            currentAdminId={user.id}
                                                            onChanged={refreshRooms}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center text-[var(--text-muted)] px-6">
                                                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                                <p className="text-lg font-bold text-[var(--text-primary)]">Select a conversation</p>
                                                <p className="text-sm mt-1">Use the filters to focus on unanswered or assigned support work.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default function AdminMessagesPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        }>
            <AdminMessagesContent />
        </React.Suspense>
    )
}
