"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import dynamic from "next/dynamic"
import { MessageSquare, RefreshCw } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { ChatRoomList } from "@/components/chat/ChatRoomList"
import { useChat } from "@/context/ChatContext"
import type { ChatRoom } from "@/lib/chatApi"

const ChatWindow = dynamic(
    () => import("@/components/chat/ChatWindow").then(mod => mod.ChatWindow),
    { ssr: false },
)

type InboxFilter = "all" | "unread" | "support"

interface RoleMessagesInboxProps {
    title?: string
    subtitle?: string
    className?: string
}

export function RoleMessagesInbox({
    title = "Messages",
    subtitle = "Your conversations in one place",
    className = "glass-card",
}: RoleMessagesInboxProps) {
    const { rooms, refreshRooms } = useChat()
    const searchParams = useSearchParams()
    const targetRoomId = searchParams.get("room")
    const [selectedRoom, setSelectedRoom] = React.useState<ChatRoom | null>(null)
    const [filter, setFilter] = React.useState<InboxFilter>("all")
    const [mobileChat, setMobileChat] = React.useState(false)
    const autoSelectedRef = React.useRef(false)

    React.useEffect(() => {
        void refreshRooms()
    }, [refreshRooms])

    React.useEffect(() => {
        const media = window.matchMedia("(max-width: 1023px)")
        const update = () => setMobileChat(media.matches)
        update()
        media.addEventListener("change", update)
        return () => media.removeEventListener("change", update)
    }, [])

    React.useEffect(() => {
        if (!mobileChat || !selectedRoom) return
        const previous = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = previous
        }
    }, [mobileChat, selectedRoom])

    React.useEffect(() => {
        if (!targetRoomId || autoSelectedRef.current) return
        const match = rooms.find(room => room.id === targetRoomId)
        if (match) {
            setFilter("all")
            setSelectedRoom(match)
            autoSelectedRef.current = true
        }
    }, [rooms, targetRoomId])

    React.useEffect(() => {
        if (!selectedRoom) return
        const fresh = rooms.find(room => room.id === selectedRoom.id)
        if (fresh) setSelectedRoom(fresh)
        // selectedRoom object changes as messages arrive; only track its ID.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, selectedRoom?.id])

    const filteredRooms = React.useMemo(() => {
        if (filter === "unread") return rooms.filter(room => room.unreadCount > 0)
        if (filter === "support") return rooms.filter(room => room.context === "SUPPORT")
        return rooms
    }, [filter, rooms])

    const counts = React.useMemo(() => ({
        all: rooms.length,
        unread: rooms.filter(room => room.unreadCount > 0).length,
        support: rooms.filter(room => room.context === "SUPPORT").length,
    }), [rooms])

    const filters: Array<{ value: InboxFilter; label: string; count: number }> = [
        { value: "all", label: "All", count: counts.all },
        { value: "unread", label: "Unread", count: counts.unread },
        { value: "support", label: "CarMazium support", count: counts.support },
    ]

    return (
        <>
            <div className={`${className} flex h-[calc(100dvh-175px)] min-h-0 min-w-0 flex-col overflow-hidden lg:h-[calc(100vh-180px)]`}>
                <div className="shrink-0 border-b border-[var(--border-default)] p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <MessageSquare className="shrink-0 text-primary" size={20} />
                            <div className="min-w-0">
                                <h2 className="truncate text-lg font-bold font-heading text-[var(--text-primary)]">
                                    {title}
                                </h2>
                                <p className="hidden truncate text-xs text-[var(--text-muted)] sm:block">
                                    {subtitle}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => void refreshRooms()}
                            className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-input)] hover:text-primary"
                            title="Refresh conversations"
                            aria-label="Refresh conversations"
                        >
                            <RefreshCw size={17} />
                        </button>
                    </div>

                    <div className="mt-3 flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {filters.map(item => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                    setFilter(item.value)
                                    if (selectedRoom && item.value !== "all") {
                                        const stillVisible = item.value === "unread"
                                            ? selectedRoom.unreadCount > 0
                                            : selectedRoom.context === "SUPPORT"
                                        if (!stillVisible) setSelectedRoom(null)
                                    }
                                }}
                                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                                    filter === item.value
                                        ? "bg-primary text-white"
                                        : "bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                }`}
                            >
                                {item.label}
                                {item.count > 0 ? ` · ${item.count}` : ""}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1">
                    <div className={`min-h-0 w-full border-r border-[var(--border-default)] lg:w-80 lg:shrink-0 ${selectedRoom ? "hidden lg:block" : ""}`}>
                        <ChatRoomList
                            onSelectRoom={setSelectedRoom}
                            selectedRoomId={selectedRoom?.id}
                            roomsOverride={filteredRooms}
                        />
                    </div>

                    <div className={`min-h-0 min-w-0 flex-1 ${selectedRoom ? "hidden lg:flex" : "hidden lg:flex lg:items-center lg:justify-center"}`}>
                        {selectedRoom ? (
                            <ChatWindow room={selectedRoom} onBack={() => setSelectedRoom(null)} />
                        ) : (
                            <div className="px-6 text-center text-[var(--text-muted)]">
                                <MessageSquare className="mx-auto mb-4 h-14 w-14 opacity-30" />
                                <p className="text-base font-semibold text-[var(--text-secondary)]">
                                    Select a conversation
                                </p>
                                <p className="mt-1 text-sm">Choose a thread to read and reply.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {mobileChat && selectedRoom && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[var(--bg-card)]"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Customer conversation"
                >
                    <ChatWindow room={selectedRoom} onBack={() => setSelectedRoom(null)} />
                </div>,
                document.body,
            )}
        </>
    )
}
