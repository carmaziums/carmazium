"use client"

import * as React from "react"
import { MessageSquare, Send, Loader2, ArrowLeft, User } from "lucide-react"
import { Button } from "@/components/ui/Button"
import Image from "next/image"
import { useChat } from "@/context/ChatContext"
import { getChatMessages, sendChatMessage, markMessagesAsRead, type ChatMessage, type ChatRoom } from "@/lib/chatApi"

interface ChatWindowProps {
    room: ChatRoom
    onBack?: () => void
}

/**
 * Real-time chat window component
 * Displays messages and handles sending new messages
 */
export function ChatWindow({ room, onBack }: ChatWindowProps) {
    const { sendMessage, onNewMessage, onTyping, markAsRead, isConnected } = useChat()
    const [messages, setMessages] = React.useState<ChatMessage[]>([])
    const [newMessage, setNewMessage] = React.useState("")
    const [loading, setLoading] = React.useState(true)
    const [sending, setSending] = React.useState(false)
    const [isTyping, setIsTyping] = React.useState(false)
    const messagesEndRef = React.useRef<HTMLDivElement>(null)
    const messagesContainerRef = React.useRef<HTMLDivElement>(null)
    const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    const isInitialLoad = React.useRef(true)
    // Track the optimistic temp message ID so we can replace it when the server confirms
    const optimisticTempId = React.useRef<string | null>(null)

    /** Returns true if the user is within 150px of the bottom of the chat */
    const isNearBottom = () => {
        const container = messagesContainerRef.current
        if (!container) return true
        return container.scrollHeight - container.scrollTop - container.clientHeight < 150
    }

    // Fetch initial messages
    React.useEffect(() => {
        isInitialLoad.current = true
        async function fetchMessages() {
            try {
                setLoading(true)
                const response = await getChatMessages(room.id)
                setMessages(response.data)
                // Mark as read via REST (persists to DB) and via context (clears badge immediately)
                await markMessagesAsRead(room.id)
                markAsRead(room.id)
            } catch (error) {
                console.error("Failed to fetch messages:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchMessages()
    }, [room.id, markAsRead])

    // Scroll to bottom on new messages — instant on first load, smooth only if near bottom
    // Guard against loading=true: the container shows a spinner then, so scrollHeight is tiny
    // and isInitialLoad would be consumed before any messages are in the DOM.
    React.useEffect(() => {
        if (loading || !messagesContainerRef.current) return
        if (isInitialLoad.current) {
            // Snap to bottom instantly when the conversation first loads
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
            isInitialLoad.current = false
            return
        }
        if (isNearBottom()) {
            // Only smooth-scroll container when near bottom
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: "smooth"
            })
        }
        // If the user has scrolled up to read older messages, don't interrupt them
    }, [messages, loading])

    // Subscribe to new messages (with deduplication and optimistic replacement)
    React.useEffect(() => {
        const unsubscribe = onNewMessage((message) => {
            if (message.chatRoomId === room.id) {
                setMessages(prev => {
                    // Deduplicate: skip if message with same ID already exists
                    if (prev.some(m => m.id === message.id)) return prev
                    // If this is the server-confirmed version of our optimistic message,
                    // replace the temp entry instead of appending a duplicate
                    const tempId = optimisticTempId.current
                    if (tempId && message.senderId !== room.otherUser.id) {
                        const idx = prev.findIndex(m => m.id === tempId)
                        if (idx !== -1) {
                            optimisticTempId.current = null
                            const next = [...prev]
                            next[idx] = message
                            return next
                        }
                    }
                    return [...prev, message]
                })
                // Mark as read immediately
                markAsRead(room.id)
            }
        })
        return unsubscribe
    }, [room.id, onNewMessage, markAsRead])

    // Subscribe to typing indicators
    React.useEffect(() => {
        const unsubscribe = onTyping((data) => {
            if (data.roomId === room.id && data.userId === room.otherUser.id) {
                setIsTyping(data.isTyping)
            }
        })
        return unsubscribe
    }, [room.id, room.otherUser.id, onTyping])

    const handleSend = async () => {
        if (!newMessage.trim()) return

        const content = newMessage.trim()
        setNewMessage("")
        setSending(true)

        try {
            if (isConnected) {
                // Optimistically add message to UI before sending
                const tempId = `temp-${Date.now()}`
                optimisticTempId.current = tempId
                const tempMsg: ChatMessage = {
                    id: tempId,
                    chatRoomId: room.id,
                    senderId: 'optimistic',
                    content,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    sender: { id: 'optimistic', firstName: 'Me', lastName: '', profileImage: null }
                }
                setMessages(prev => [...prev, tempMsg])
                // Use WebSocket for real-time — server will echo back via message:new
                // which the subscription handler above will use to replace the temp entry
                sendMessage(room.id, content)
            } else {
                // Fallback to HTTP
                const message = await sendChatMessage(room.id, content)
                setMessages(prev => [...prev, message])
            }
        } catch (error) {
            console.error("Failed to send message:", error)
            // Remove the optimistic message and restore input on error
            const tempId = optimisticTempId.current
            if (tempId) {
                setMessages(prev => prev.filter(m => m.id !== tempId))
                optimisticTempId.current = null
            }
            setNewMessage(content)
        } finally {
            setSending(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (date: string) => {
        const d = new Date(date)
        const today = new Date()
        if (d.toDateString() === today.toDateString()) return "Today"
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
        return d.toLocaleDateString()
    }

    // Group messages by date
    const groupedMessages = React.useMemo(() => {
        const groups: { date: string; messages: ChatMessage[] }[] = []
        let currentDate = ""

        messages.forEach(msg => {
            const date = formatDate(msg.createdAt)
            if (date !== currentDate) {
                currentDate = date
                groups.push({ date, messages: [msg] })
            } else {
                groups[groups.length - 1].messages.push(msg)
            }
        })

        return groups
    }, [messages])

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-[var(--bg-input)] rounded-xl border border-[var(--border-default)]">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-[var(--border-default)]">
                {onBack && (
                    <button onClick={onBack} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className="relative w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center overflow-hidden">
                    {room.otherUser.profileImage ? (
                        <Image src={room.otherUser.profileImage} alt="" fill sizes="40px" className="object-cover" />
                    ) : (
                        <User size={20} className="text-[var(--text-muted)]" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold">
                        {room.otherUser.firstName} {room.otherUser.lastName}
                    </h3>
                    {room.listing && (
                        <p className="text-xs text-[var(--text-muted)] truncate">
                            Re: {room.listing.title}
                        </p>
                    )}
                </div>
                {/* Connection status indicator */}
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full transition-colors ${
                        isConnected
                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                            : 'bg-yellow-500'
                    }`} />
                    <span className={`text-xs ${
                        isConnected ? 'text-emerald-400' : 'text-yellow-500'
                    }`}>
                        {isConnected ? 'Online' : 'Offline'}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-[var(--text-muted)] py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Send a message to start the conversation</p>
                    </div>
                ) : (
                    groupedMessages.map((group, gi) => (
                        <div key={gi}>
                            <div className="flex justify-center my-4">
                                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] px-3 py-1 rounded-full">
                                    {group.date}
                                </span>
                            </div>
                            {group.messages.map((msg) => {
                                const isOwn = msg.senderId !== room.otherUser.id
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                                    >
                                        <div
                                            className={`max-w-[75%] px-4 py-2 rounded-2xl ${isOwn
                                                ? 'bg-primary text-white rounded-br-sm'
                                                : 'bg-[var(--bg-card)] text-[var(--text-primary)] rounded-bl-sm'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                            <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                                                {formatTime(msg.createdAt)}
                                                {isOwn && msg.isRead && ' ✓✓'}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))
                )}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--bg-card)] text-[var(--text-muted)] px-4 py-2 rounded-2xl rounded-bl-sm">
                            <span className="flex gap-1">
                                <span className="animate-bounce">.</span>
                                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[var(--border-default)]">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                        disabled={sending}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="px-4"
                    >
                        {sending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
