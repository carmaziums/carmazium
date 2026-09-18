"use client"

import * as React from "react"
import { MessageSquare, MessageSquarePlus, Radio } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { ChatRoomList } from "@/components/chat/ChatRoomList"
import { AdminBroadcastComposer } from "@/components/admin/AdminBroadcastComposer"
import { AdminNewConversation } from "@/components/admin/AdminNewConversation"
import dynamic from "next/dynamic"
const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow").then(mod => mod.ChatWindow), { ssr: false })
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { useSearchParams, useRouter } from "next/navigation"
import type { ChatRoom } from "@/lib/chatApi"

function AdminMessagesContent() {
    const { user, profile, loading } = useAuth()
    const { rooms, refreshRooms } = useChat()
    const searchParams = useSearchParams()
    const router = useRouter()
    const targetRoomId = searchParams.get("room")
    const [selectedRoom, setSelectedRoom] = React.useState<ChatRoom | null>(null)
    const [mode, setMode] = React.useState<"inbox" | "new" | "broadcast">("inbox")
    const autoSelectedRef = React.useRef(false)

    React.useEffect(() => {
        if (loading) return
        if (!user) { router.replace('/auth/login'); return }
        if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
    }, [user, profile, loading, router])

    React.useEffect(() => {
        if (!user) return
        refreshRooms()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    React.useEffect(() => {
        if (!targetRoomId || autoSelectedRef.current) return
        const match = rooms.find(r => r.id === targetRoomId)
        if (match) {
            setMode("inbox")
            setSelectedRoom(match)
            autoSelectedRef.current = true
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, targetRoomId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-24 lg:pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Admin Account" />

                <main className="flex-1 min-w-0">
                    <div className="glass-card overflow-hidden h-[calc(100vh-180px)] min-h-[620px]">
                        <div className="p-4 sm:p-6 border-b border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <MessageSquare className="text-primary shrink-0" />
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold font-heading">Admin Messages</h2>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                                        Direct support conversations and secure audience broadcasts
                                    </p>
                                </div>
                            </div>

                            <div className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-1 shrink-0">
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
                            </div>
                        </div>

                        <div className="h-[calc(100%-105px)] sm:h-[calc(100%-89px)]">
                            {mode === "broadcast" ? (
                                <AdminBroadcastComposer />
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
                                <div className="flex h-full">
                                    <div className={`w-full lg:w-80 border-r border-[var(--border-default)] ${selectedRoom ? 'hidden lg:block' : ''}`}>
                                        <ChatRoomList
                                            onSelectRoom={setSelectedRoom}
                                            selectedRoomId={selectedRoom?.id}
                                        />
                                    </div>

                                    <div className={`flex-1 min-w-0 ${!selectedRoom ? 'hidden lg:flex lg:items-center lg:justify-center' : ''}`}>
                                        {selectedRoom ? (
                                            <ChatWindow
                                                room={selectedRoom}
                                                onBack={() => setSelectedRoom(null)}
                                            />
                                        ) : (
                                            <div className="text-center text-[var(--text-muted)] px-6">
                                                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                                <p className="text-lg font-bold text-[var(--text-primary)]">Select a conversation</p>
                                                <p className="text-sm mt-1">Use Broadcast when you need to reach a group or all members at once.</p>
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
