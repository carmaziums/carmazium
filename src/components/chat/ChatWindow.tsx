"use client"

import * as React from "react"
import { MessageSquare, Send, Loader2, ArrowLeft, User } from "lucide-react"
import { Button } from "@/components/ui/Button"
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
    const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

    // Fetch initial messages
    React.useEffect(() => {
        async function fetchMessages() {
            try {
                setLoading(true)
                const response = await getChatMessages(room.id)
                setMessages(response.data)
                // Mark as read when opening
                await markMessagesAsRead(room.id)
            } catch (error) {
                console.error("Failed to fetch messages:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchMessages()
    }, [room.id])

    // Scroll to bottom when messages change
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Subscribe to new messages
    React.useEffect(() => {
        const unsubscribe = onNewMessage((message) => {
            if (message.chatRoomId === room.id) {
                setMessages(prev => [...prev, message])
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
                // Use WebSocket for real-time
                sendMessage(room.id, content)
            } else {
                // Fallback to HTTP
                const message = await sendChatMessage(room.id, content)
                setMessages(prev => [...prev, message])
            }
        } catch (error) {
            console.error("Failed to send message:", error)
            setNewMessage(content)  // Restore message on error
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
        <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-white/10">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
                {onBack && (
                    <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                    {room.otherUser.profileImage ? (
                        <img src={room.otherUser.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <User size={20} className="text-gray-400" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-white">
                        {room.otherUser.firstName} {room.otherUser.lastName}
                    </h3>
                    {room.listing && (
                        <p className="text-xs text-gray-400 truncate">
                            Re: {room.listing.title}
                        </p>
                    )}
                </div>
                {!isConnected && (
                    <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                        Offline
                    </span>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Send a message to start the conversation</p>
                    </div>
                ) : (
                    groupedMessages.map((group, gi) => (
                        <div key={gi}>
                            <div className="flex justify-center my-4">
                                <span className="text-xs text-gray-500 bg-slate-800 px-3 py-1 rounded-full">
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
                                                    : 'bg-slate-700 text-white rounded-bl-sm'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                            <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
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
                        <div className="bg-slate-700 text-gray-400 px-4 py-2 rounded-2xl rounded-bl-sm">
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
            <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
