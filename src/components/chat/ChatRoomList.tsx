"use client"

import * as React from "react"
import Image from "next/image"
import { MessageSquare, Search, User, Loader2, Check, ShieldAlert, Ban } from "lucide-react"
import { useChat } from "@/context/ChatContext"
import { getChatDisplayName, isSupportUser, type ChatRoom } from "@/lib/chatApi"
import { chatMessagePreview } from "@/lib/chatMessageContent"

interface ChatRoomListProps {
    onSelectRoom: (room: ChatRoom) => void
    selectedRoomId?: string
    roomsOverride?: ChatRoom[]
    showSupportOps?: boolean
}

/**
 * Chat room list component
 * Displays all conversations with last message preview
 */
export function ChatRoomList({
    onSelectRoom,
    selectedRoomId,
    roomsOverride,
    showSupportOps = false,
}: ChatRoomListProps) {
    const { rooms, isLoading, refreshRooms, onNewMessage } = useChat()
    const sourceRooms = roomsOverride ?? rooms
    const [searchTerm, setSearchTerm] = React.useState("")

    // Refresh rooms when a new message arrives
    React.useEffect(() => {
        const unsubscribe = onNewMessage(() => {
            refreshRooms()
        })
        return unsubscribe
    }, [onNewMessage, refreshRooms])

    const filteredRooms = React.useMemo(() => {
        if (!searchTerm) return sourceRooms
        const term = searchTerm.toLowerCase()
        return sourceRooms.filter(room => {
            const name = getChatDisplayName(room.otherUser).toLowerCase()
            const listing = room.listing?.title?.toLowerCase() || ''
            return name.includes(term) || listing.includes(term)
        })
    }, [sourceRooms, searchTerm])

    const formatTime = (date: string) => {
        const d = new Date(date)
        const now = new Date()
        const diff = now.getTime() - d.getTime()
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (days === 0) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else if (days === 1) {
            return 'Yesterday'
        } else if (days < 7) {
            return d.toLocaleDateString([], { weekday: 'short' })
        } else {
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        }
    }

    const truncateMessage = (text: string, maxLength = 40) => {
        if (!text) return ''
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-4 border-b border-[var(--border-default)]">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg pl-10 pr-4 py-2 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-y-auto">
                {filteredRooms.length === 0 ? (
                    <div className="text-center text-[var(--text-muted)] py-12 px-6">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
                        <p className="font-semibold text-[var(--text-secondary)]">No conversations yet</p>
                        <p className="text-sm mt-1">
                            Messages from listings you contact land here — or use Contact Support in the sidebar
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-default)]">
                        {filteredRooms.map((room) => {
                            const support = isSupportUser(room.otherUser)
                            const isSelected = selectedRoomId === room.id
                            return (
                                <button
                                    key={room.id}
                                    onClick={() => onSelectRoom(room)}
                                    className={`w-full p-4 text-left transition-colors flex gap-3 relative ${isSelected ? 'bg-primary/10' : 'hover:bg-[var(--bg-card)]'}`}
                                >
                                    {isSelected && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" aria-hidden />}

                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden relative ${support ? 'bg-[var(--bg-input)] ring-1 ring-primary/30' : 'bg-[var(--bg-card)]'}`}>
                                            {support ? (
                                                <Image src="/assets/images/logo.png" alt="" fill sizes="48px" className="object-contain p-2.5" />
                                            ) : room.otherUser?.profileImage ? (
                                                <Image
                                                    src={room.otherUser.profileImage}
                                                    alt=""
                                                    fill
                                                    sizes="48px"
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <User className="text-[var(--text-muted)]" size={22} />
                                            )}
                                        </div>
                                        {support && (
                                            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary ring-2 ring-[var(--bg-input)] flex items-center justify-center">
                                                <Check size={9} strokeWidth={3.5} className="text-white" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <h4 className="font-bold text-[var(--text-primary)] truncate text-[15px]">
                                                {getChatDisplayName(room.otherUser)}
                                            </h4>
                                            {room.lastMessage && (
                                                <span className="text-[11px] text-[var(--text-muted)] shrink-0 tabular-nums">
                                                    {formatTime(room.lastMessage.createdAt)}
                                                </span>
                                            )}
                                        </div>

                                        {room.listing && (
                                            <p className="text-xs text-primary/90 truncate mb-1 font-medium">
                                                {room.listing.title}
                                            </p>
                                        )}

                                        {room.context === 'DISPUTE' && (
                                            <div className="mb-1.5 flex flex-wrap gap-1">
                                                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${room.disputeCase?.status === 'RESOLVED'
                                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                                }`}>
                                                    <ShieldAlert size={9} />
                                                    {room.disputeCase?.status === 'RESOLVED' ? 'Resolved dispute' : 'Dispute'}
                                                </span>
                                                {room.disputeCase?.joinedAdminId && (
                                                    <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                                                        CarMazium joined
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {room.chatBlocked && room.context !== 'DISPUTE' && (
                                            <div className="mb-1.5">
                                                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-400">
                                                    <Ban size={9} />
                                                    {room.blockedByMe ? 'Blocked by you' : 'Messaging blocked'}
                                                </span>
                                            </div>
                                        )}

                                        {showSupportOps && room.context === 'SUPPORT' && (
                                            <div className="mb-1.5 flex flex-wrap gap-1">
                                                {room.needsReply && !room.supportClosedAt && (
                                                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-400">
                                                        Needs reply
                                                    </span>
                                                )}
                                                {room.supportClosedAt && (
                                                    <span className="rounded-full border border-[var(--border-default)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--text-muted)]">
                                                        Closed
                                                    </span>
                                                )}
                                                {room.supportAssignedAdmin && (
                                                    <span className="max-w-[130px] truncate rounded-full border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-black text-blue-400">
                                                        {(`${room.supportAssignedAdmin.firstName ?? ''} ${room.supportAssignedAdmin.lastName ?? ''}`).trim() || room.supportAssignedAdmin.email}
                                                    </span>
                                                )}
                                                {(room.supportTags || []).slice(0, 2).map(tag => (
                                                    <span key={tag} className="rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2">
                                            <p className={`text-sm truncate ${room.unreadCount > 0 ? 'text-[var(--text-secondary)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                                                {room.lastMessage
                                                    ? room.lastMessage.attachmentPath
                                                        ? (room.lastMessage.content
                                                            ? `Photo · ${truncateMessage(chatMessagePreview(room.lastMessage.content), 30)}`
                                                            : 'Photo')
                                                        : truncateMessage(chatMessagePreview(room.lastMessage.content))
                                                    : 'No messages yet'}
                                            </p>
                                            {room.unreadCount > 0 && (
                                                <span className="bg-primary text-white text-[11px] font-bold min-w-[18px] h-[18px] px-1 rounded-full shrink-0 flex items-center justify-center tabular-nums">
                                                    {room.unreadCount > 9 ? '9+' : room.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
