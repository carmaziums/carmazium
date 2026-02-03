"use client"

import * as React from "react"
import { MessageSquare, Search, User, Loader2 } from "lucide-react"
import { useChat } from "@/context/ChatContext"
import type { ChatRoom } from "@/lib/chatApi"

interface ChatRoomListProps {
    onSelectRoom: (room: ChatRoom) => void
    selectedRoomId?: string
}

/**
 * Chat room list component
 * Displays all conversations with last message preview
 */
export function ChatRoomList({ onSelectRoom, selectedRoomId }: ChatRoomListProps) {
    const { rooms, isLoading, refreshRooms, onNewMessage } = useChat()
    const [searchTerm, setSearchTerm] = React.useState("")

    // Refresh rooms when a new message arrives
    React.useEffect(() => {
        const unsubscribe = onNewMessage(() => {
            refreshRooms()
        })
        return unsubscribe
    }, [onNewMessage, refreshRooms])

    const filteredRooms = React.useMemo(() => {
        if (!searchTerm) return rooms
        const term = searchTerm.toLowerCase()
        return rooms.filter(room => {
            const name = `${room.otherUser.firstName || ''} ${room.otherUser.lastName || ''}`.toLowerCase()
            const listing = room.listing?.title?.toLowerCase() || ''
            return name.includes(term) || listing.includes(term)
        })
    }, [rooms, searchTerm])

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
            <div className="p-4 border-b border-white/10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-y-auto">
                {filteredRooms.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No conversations yet</p>
                        <p className="text-sm mt-1">
                            Start a chat from a listing page
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredRooms.map((room) => (
                            <button
                                key={room.id}
                                onClick={() => onSelectRoom(room)}
                                className={`w-full p-4 text-left hover:bg-white/5 transition-colors flex gap-3 ${selectedRoomId === room.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {room.otherUser.profileImage ? (
                                        <img
                                            src={room.otherUser.profileImage}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="text-gray-400" size={24} />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-bold text-white truncate">
                                            {room.otherUser.firstName} {room.otherUser.lastName}
                                        </h4>
                                        {room.lastMessage && (
                                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                                {formatTime(room.lastMessage.createdAt)}
                                            </span>
                                        )}
                                    </div>

                                    {room.listing && (
                                        <p className="text-xs text-primary truncate mb-1">
                                            {room.listing.title}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-400 truncate">
                                            {room.lastMessage
                                                ? truncateMessage(room.lastMessage.content)
                                                : 'No messages yet'}
                                        </p>
                                        {room.unreadCount > 0 && (
                                            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                                                {room.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
