"use client"

import * as React from "react"
import { MessageSquare, Send, Loader2, ArrowLeft, User, Check, Zap, Paperclip, ShieldAlert, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import Image from "next/image"
import { useChat } from "@/context/ChatContext"
import { useAuth } from "@/context/AuthContext"
import { createChatAttachmentUpload, getChatMessages, sendChatAttachment, sendChatMessage, markMessagesAsRead, getChatDisplayName, isSupportUser, openVehicleDispute, type ChatHistoryCursor, type ChatMessage, type ChatRoom } from "@/lib/chatApi"
import { disputeEventLabel, parseChatMessageContent, parseDisputeEventContent } from "@/lib/chatMessageContent"
import { resolveAdminDispute } from "@/lib/adminApi"
import { supabase } from "@/lib/supabase"

interface ChatWindowProps {
    room: ChatRoom
    onBack?: () => void
}

// Common replies for the admin fielding support conversations — inserted
// into the input for a quick edit before sending, never sent unreviewed.
const ADMIN_QUICK_REPLIES = [
    { label: "On it", text: "Thanks for reaching out — we're looking into this now." },
    { label: "Need details", text: "Could you share the listing or order this is about?" },
    { label: "Resolved", text: "This has been resolved on our end — let us know if anything's still not right!" },
    { label: "Escalated", text: "We've escalated this internally and will follow up as soon as we hear back." },
    { label: "Sign-off", text: "Happy to help — anything else I can do for you?" },
]

/**
 * Real-time chat window component
 * Displays messages and handles sending new messages
 */
export function ChatWindow({ room, onBack }: ChatWindowProps) {
    const { sendMessage, onNewMessage, onTyping, markAsRead, refreshRooms, isConnected, onlineUserIds } = useChat()
    const { profile, user } = useAuth()
    const isAdminViewer = profile?.role === 'ADMIN'
    const otherUserOnline = room.otherUser ? onlineUserIds.has(room.otherUser.id) : false
    const [messages, setMessages] = React.useState<ChatMessage[]>([])
    const [newMessage, setNewMessage] = React.useState("")
    const [loading, setLoading] = React.useState(true)
    const [loadingOlder, setLoadingOlder] = React.useState(false)
    const [hasMore, setHasMore] = React.useState(false)
    const [historyCursor, setHistoryCursor] = React.useState<ChatHistoryCursor | null>(null)
    const [sending, setSending] = React.useState(false)
    const [uploadingAttachment, setUploadingAttachment] = React.useState(false)
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null)
    const [isTyping, setIsTyping] = React.useState(false)
    const [showDisputeForm, setShowDisputeForm] = React.useState(false)
    const [disputeReason, setDisputeReason] = React.useState("")
    const [disputeActionError, setDisputeActionError] = React.useState<string | null>(null)
    const [openingDispute, setOpeningDispute] = React.useState(false)
    const [disputeOpened, setDisputeOpened] = React.useState(false)
    const [resolvingDispute, setResolvingDispute] = React.useState(false)
    const [resolvedLocally, setResolvedLocally] = React.useState(false)
    const messagesEndRef = React.useRef<HTMLDivElement>(null)
    const messagesContainerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const attachmentInputRef = React.useRef<HTMLInputElement>(null)
    const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    const isInitialLoad = React.useRef(true)

    const isDispute = room.context === 'DISPUTE'
    const disputeResolved = resolvedLocally || room.disputeCase?.status === 'RESOLVED'
    const disputeAdminJoined = !!room.disputeCase?.joinedAdminId

    React.useEffect(() => {
        setShowDisputeForm(false)
        setDisputeReason("")
        setDisputeActionError(null)
        setDisputeOpened(false)
        setResolvedLocally(room.disputeCase?.status === 'RESOLVED')
    }, [room.id, room.disputeCase?.status])

    const openDispute = async () => {
        if (!room.canOpenDispute || openingDispute) return

        try {
            setOpeningDispute(true)
            setDisputeActionError(null)
            const result = await openVehicleDispute(room.id, disputeReason)
            setDisputeOpened(true)
            setShowDisputeForm(false)
            setDisputeReason("")
            await refreshRooms()
            if (!result.created) {
                setDisputeActionError("A dispute already exists for this transaction. Select the Dispute conversation from your message list.")
            }
        } catch (error: any) {
            if (error?.message !== "AUTH_REDIRECT") {
                setDisputeActionError(error?.message || "Could not open dispute")
            }
        } finally {
            setOpeningDispute(false)
        }
    }

    const resolveDispute = async () => {
        if (!room.disputeCase?.id || resolvingDispute || !isAdminViewer) return

        try {
            setResolvingDispute(true)
            setDisputeActionError(null)
            await resolveAdminDispute(room.disputeCase.id)
            setResolvedLocally(true)
            await refreshRooms()
        } catch (error: any) {
            if (error?.message !== "AUTH_REDIRECT") {
                setDisputeActionError(error?.message || "Could not resolve dispute")
            }
        } finally {
            setResolvingDispute(false)
        }
    }

    /** Returns true if the user is within 150px of the bottom of the chat */
    const isNearBottom = () => {
        const container = messagesContainerRef.current
        if (!container) return true
        return container.scrollHeight - container.scrollTop - container.clientHeight < 150
    }

    // Fetch the newest page first. Older history is loaded with a stable
    // message cursor so incoming realtime messages cannot shift page offsets.
    React.useEffect(() => {
        isInitialLoad.current = true
        setHistoryCursor(null)
        setHasMore(false)

        async function fetchMessages() {
            try {
                setLoading(true)
                const response = await getChatMessages(room.id)
                setMessages(response.data)
                setHasMore(Boolean(response.pagination.hasMore))
                setHistoryCursor(
                    response.pagination.nextCursor ??
                    (response.data[0]
                        ? { createdAt: response.data[0].createdAt, id: response.data[0].id }
                        : null)
                )
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

    // Subscribe to new messages. Server IDs dedupe normal broadcasts while
    // clientMessageId replaces the exact optimistic/retrying bubble.
    React.useEffect(() => {
        const unsubscribe = onNewMessage((message) => {
            if (message.chatRoomId === room.id) {
                setMessages(prev => {
                    if (prev.some(m => m.id === message.id)) return prev

                    if (message.clientMessageId) {
                        const optimisticIndex = prev.findIndex(
                            m => m.clientMessageId === message.clientMessageId
                        )
                        if (optimisticIndex !== -1) {
                            const next = [...prev]
                            next[optimisticIndex] = message
                            return next
                        }
                    }

                    return [...prev, message]
                })
                markAsRead(room.id)
            }
        })
        return unsubscribe
    }, [room.id, onNewMessage, markAsRead])

    // Subscribe to typing indicators
    React.useEffect(() => {
        const unsubscribe = onTyping((data) => {
            const fromOtherParticipant = isDispute
                ? data.userId !== user?.id
                : data.userId === room.otherUser?.id
            if (data.roomId === room.id && fromOtherParticipant) {
                setIsTyping(data.isTyping)
            }
        })
        return unsubscribe
    }, [room.id, room.otherUser?.id, isDispute, user?.id, onTyping])

    const loadOlderMessages = async () => {
        if (!historyCursor || !hasMore || loadingOlder) return

        const container = messagesContainerRef.current
        const previousScrollHeight = container?.scrollHeight ?? 0
        const previousScrollTop = container?.scrollTop ?? 0

        try {
            setLoadingOlder(true)
            const response = await getChatMessages(room.id, 1, 50, historyCursor)
            setMessages(prev => {
                const existingIds = new Set(prev.map(message => message.id))
                const older = response.data.filter(message => !existingIds.has(message.id))
                return [...older, ...prev]
            })
            setHasMore(Boolean(response.pagination.hasMore))
            setHistoryCursor(
                response.pagination.nextCursor ??
                (response.data[0]
                    ? { createdAt: response.data[0].createdAt, id: response.data[0].id }
                    : null)
            )

            // Prepending history must not make the viewport jump away from the
            // message the user was reading.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!container) return
                    container.scrollTop =
                        container.scrollHeight - previousScrollHeight + previousScrollTop
                })
            })
        } catch (error) {
            console.error("Failed to load earlier messages:", error)
        } finally {
            setLoadingOlder(false)
        }
    }

    const insertQuickReply = (text: string) => {
        setNewMessage(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))
        inputRef.current?.focus()
    }

    const deliverMessage = async (
        content: string,
        clientMessageId: string,
    ): Promise<ChatMessage> => {
        if (isConnected) {
            try {
                return await sendMessage(room.id, content, clientMessageId)
            } catch (error) {
                const code = (error as { code?: string })?.code
                if (code !== 'CHAT_ACK_TIMEOUT' && code !== 'SOCKET_UNAVAILABLE') {
                    throw error
                }
                // The server may have persisted the message even if the ack was
                // lost. HTTP retries with the same clientMessageId are safe.
            }
        }

        return sendChatMessage(room.id, content, clientMessageId)
    }

    const confirmLocalMessage = (
        clientMessageId: string,
        confirmed: ChatMessage,
    ) => {
        setMessages(prev => {
            const index = prev.findIndex(
                message =>
                    message.id === confirmed.id ||
                    message.clientMessageId === clientMessageId
            )
            if (index === -1) {
                return [...prev, confirmed]
            }

            const next = [...prev]
            next[index] = confirmed
            return next
        })
    }

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return

        const content = newMessage.trim()
        const clientMessageId = crypto.randomUUID()
        const tempId = `temp-${clientMessageId}`
        const now = new Date().toISOString()

        const tempMsg: ChatMessage = {
            id: tempId,
            chatRoomId: room.id,
            senderId: 'optimistic',
            clientMessageId,
            content,
            isRead: false,
            createdAt: now,
            updatedAt: now,
            sender: {
                id: 'optimistic',
                firstName: 'Me',
                lastName: '',
                profileImage: null,
            },
            deliveryStatus: 'sending',
        }

        setNewMessage("")
        setSending(true)
        setMessages(prev => [...prev, tempMsg])

        try {
            const confirmed = await deliverMessage(content, clientMessageId)
            confirmLocalMessage(clientMessageId, confirmed)
        } catch (error) {
            console.error("Failed to send message:", error)
            setMessages(prev => prev.map(message =>
                message.clientMessageId === clientMessageId
                    ? { ...message, deliveryStatus: 'failed' }
                    : message
            ))
        } finally {
            setSending(false)
        }
    }

    const handleRetry = async (message: ChatMessage) => {
        if (!message.clientMessageId || message.deliveryStatus !== 'failed') return

        const clientMessageId = message.clientMessageId
        setMessages(prev => prev.map(item =>
            item.clientMessageId === clientMessageId
                ? { ...item, deliveryStatus: 'sending' }
                : item
        ))

        try {
            const confirmed = await deliverMessage(message.content, clientMessageId)
            confirmLocalMessage(clientMessageId, confirmed)
        } catch (error) {
            console.error("Failed to retry message:", error)
            setMessages(prev => prev.map(item =>
                item.clientMessageId === clientMessageId
                    ? { ...item, deliveryStatus: 'failed' }
                    : item
            ))
        }
    }

    const handlePhotoFile = async (file?: File) => {
        if (!file || uploadingAttachment) return

        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowed.includes(file.type)) {
            setAttachmentError('Only JPEG, PNG or WebP photos can be sent.')
            return
        }
        if (file.size < 1 || file.size > 10 * 1024 * 1024) {
            setAttachmentError('Photos must be 10 MB or smaller.')
            return
        }

        const caption = newMessage.trim()
        const clientMessageId = crypto.randomUUID()

        try {
            setUploadingAttachment(true)
            setAttachmentError(null)

            const ticket = await createChatAttachmentUpload(room.id, file)
            const { error } = await supabase.storage
                .from(ticket.bucket)
                .uploadToSignedUrl(ticket.path, ticket.token, file, {
                    contentType: file.type,
                })

            if (error) throw error

            const confirmed = await sendChatAttachment(room.id, {
                path: ticket.path,
                name: file.name,
                mime: file.type,
                size: file.size,
                caption: caption || undefined,
                clientMessageId,
            })

            if (caption) setNewMessage("")
            confirmLocalMessage(clientMessageId, confirmed)
        } catch (error: any) {
            console.error('Failed to send photo:', error)
            setAttachmentError(error?.message || 'Photo could not be sent.')
        } finally {
            setUploadingAttachment(false)
            if (attachmentInputRef.current) attachmentInputRef.current.value = ''
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
                    <button onClick={onBack} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden relative ${isSupportUser(room.otherUser) ? 'bg-[var(--bg-card)] ring-1 ring-primary/30' : 'bg-[var(--bg-card)]'}`}>
                        {isSupportUser(room.otherUser) ? (
                            <Image src="/assets/images/logo.png" alt="" fill sizes="40px" className="object-contain p-2" />
                        ) : room.otherUser?.profileImage ? (
                            <Image src={room.otherUser.profileImage} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                            <User size={20} className="text-[var(--text-muted)]" />
                        )}
                    </div>
                    {isSupportUser(room.otherUser) && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-[var(--bg-input)] flex items-center justify-center">
                            <Check size={8} strokeWidth={3.5} className="text-white" />
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">
                        {getChatDisplayName(room.otherUser)}
                    </h3>
                    {room.listing ? (
                        <p className="text-xs text-[var(--text-muted)] truncate">
                            Re: {room.listing.title}
                        </p>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${otherUserOnline ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]' : 'bg-[var(--text-muted)]'}`} />
                            <span className={`text-xs ${otherUserOnline ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                                {otherUserOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    )}
                </div>
                {/* My own connection state — only worth surfacing when it's degraded */}
                {!isConnected && (
                    <span className="text-xs text-yellow-500 flex items-center gap-1.5 shrink-0" title="Reconnecting — messages will send once you're back online">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                        Reconnecting
                    </span>
                )}
            </div>

            {(isDispute || room.canOpenDispute || room.sourceDispute || disputeOpened) && (
                <div className="border-b border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3">
                    {isDispute ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${disputeResolved
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                    }`}>
                                        <ShieldAlert size={11} />
                                        {disputeResolved ? "Resolved dispute" : "Open dispute"}
                                    </span>
                                    <span className="text-xs text-[var(--text-muted)]">
                                        {disputeAdminJoined ? "CarMazium has joined this case" : "Awaiting CarMazium review"}
                                    </span>
                                </div>
                                {isAdminViewer && room.disputeCase?.buyer && room.disputeCase?.seller && (
                                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                                        Buyer: {getChatDisplayName(room.disputeCase.buyer)} · Seller: {getChatDisplayName(room.disputeCase.seller)}
                                    </p>
                                )}
                                {room.disputeCase?.reason && (
                                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">
                                        Reason: {room.disputeCase.reason}
                                    </p>
                                )}
                            </div>

                            {isAdminViewer &&
                                !disputeResolved &&
                                room.disputeCase?.joinedAdminId === user?.id && (
                                    <button
                                        type="button"
                                        onClick={resolveDispute}
                                        disabled={resolvingDispute}
                                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-400 disabled:opacity-50"
                                    >
                                        {resolvingDispute ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <CheckCircle2 size={14} />
                                        )}
                                        Resolve dispute
                                    </button>
                                )}
                        </div>
                    ) : room.sourceDispute || disputeOpened ? (
                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                            <ShieldAlert size={16} className="shrink-0 text-amber-400" />
                            A separate dispute conversation exists for this transaction. Select the Dispute conversation from your message list.
                        </div>
                    ) : room.canOpenDispute ? (
                        <div>
                            {!showDisputeForm ? (
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-[var(--text-primary)]">Need CarMazium to review this transaction?</p>
                                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                            Opening a dispute creates a separate buyer, seller and CarMazium case. Your private vehicle chat remains private.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowDisputeForm(true)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-400"
                                    >
                                        <ShieldAlert size={14} />
                                        Open dispute
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <textarea
                                        value={disputeReason}
                                        onChange={(event) => setDisputeReason(event.target.value)}
                                        maxLength={1000}
                                        rows={3}
                                        placeholder="Briefly explain what CarMazium needs to review (optional)"
                                        className="w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[11px] text-[var(--text-muted)]">{disputeReason.length}/1000</span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowDisputeForm(false)
                                                    setDisputeReason("")
                                                }}
                                                disabled={openingDispute}
                                                className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-bold"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={openDispute}
                                                disabled={openingDispute}
                                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                            >
                                                {openingDispute ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                                                {openingDispute ? "Opening…" : "Create dispute case"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {disputeActionError && (
                        <p className="mt-2 text-xs text-red-400">{disputeActionError}</p>
                    )}
                </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-[var(--text-muted)] py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
                        <p className="font-semibold text-[var(--text-secondary)]">
                            {isSupportUser(room.otherUser) ? 'Ask CarMazium anything' : 'No messages yet'}
                        </p>
                        <p className="text-sm mt-0.5 max-w-xs mx-auto">
                            {isSupportUser(room.otherUser) ? 'We typically respond within 12–24 hours' : 'Send a message to start the conversation'}
                        </p>
                    </div>
                ) : (
                    <>
                        {hasMore && (
                            <div className="flex justify-center pb-2">
                                <button
                                    type="button"
                                    onClick={loadOlderMessages}
                                    disabled={loadingOlder}
                                    className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-60"
                                >
                                    {loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
                                </button>
                            </div>
                        )}
                        {groupedMessages.map((group, gi) => (
                        <div key={gi}>
                            <div className="flex justify-center my-4">
                                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] px-3 py-1 rounded-full">
                                    {group.date}
                                </span>
                            </div>
                            {group.messages.map((msg) => {
                                const disputeEvent = isDispute
                                    ? parseDisputeEventContent(msg.content)
                                    : null

                                if (disputeEvent) {
                                    return (
                                        <div key={msg.id} className="my-3 flex justify-center">
                                            <div className="max-w-[90%] rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-center">
                                                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                                                    <ShieldAlert size={13} />
                                                    {disputeEventLabel(disputeEvent)}
                                                </p>
                                                <p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatTime(msg.createdAt)}</p>
                                            </div>
                                        </div>
                                    )
                                }

                                const isOwn = !!msg.deliveryStatus || msg.senderId === user?.id
                                // The media envelope is an internal admin format. A normal
                                // member typing the same prefix must never make arbitrary
                                // text render as trusted CarMazium media.
                                const trustedAdminSide = isAdminViewer
                                    ? isOwn
                                    : isSupportUser(room.otherUser) && !isOwn
                                const parsed = trustedAdminSide
                                    ? parseChatMessageContent(msg.content)
                                    : { text: msg.content, media: null }
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                                    >
                                        <div
                                            className={`max-w-[82%] sm:max-w-[75%] px-3 py-2 rounded-2xl shadow-sm ${isOwn
                                                ? `bg-primary text-white rounded-br-sm ${msg.deliveryStatus === 'failed' ? 'ring-2 ring-red-400/70' : ''}`
                                                : 'bg-[var(--bg-card)] text-[var(--text-primary)] rounded-bl-sm'
                                                }`}
                                        >
                                            {msg.attachmentPath && (
                                                <div className="mb-2 overflow-hidden rounded-xl bg-black/10">
                                                    {msg.attachmentUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={msg.attachmentUrl}
                                                            alt={msg.attachmentName || 'Private chat photo'}
                                                            className="block max-h-[420px] w-auto max-w-full object-contain"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="px-4 py-8 text-center text-xs opacity-75">
                                                            Private photo unavailable. Reopen the conversation to refresh access.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {parsed.media && (
                                                <div className="mb-2 overflow-hidden rounded-xl bg-black/10">
                                                    {parsed.media.kind === 'IMAGE' ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={parsed.media.url}
                                                            alt={parsed.media.name || 'Photo from CarMazium'}
                                                            className="block max-h-[420px] w-auto max-w-full object-contain"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <video
                                                            src={parsed.media.url}
                                                            controls
                                                            preload="metadata"
                                                            playsInline
                                                            className="block max-h-[420px] w-full bg-black"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            {parsed.text && (
                                                <p className="text-sm whitespace-pre-wrap break-words px-1">{parsed.text}</p>
                                            )}
                                            <div className={`flex items-center gap-1.5 text-[10px] mt-1 px-1 ${isOwn ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                                                <span>{formatTime(msg.createdAt)}</span>
                                                {isOwn && msg.deliveryStatus === 'sending' && (
                                                    <span>Sending…</span>
                                                )}
                                                {isOwn && msg.deliveryStatus === 'failed' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRetry(msg)}
                                                        className="font-semibold text-white underline underline-offset-2"
                                                    >
                                                        Not sent · Retry
                                                    </button>
                                                )}
                                                {isOwn && !isDispute && !msg.deliveryStatus && (
                                                    <svg width="13" height="9" viewBox="0 0 16 11" fill="none" className={msg.isRead ? 'text-white' : 'text-white/50'}>
                                                        <path d="M1 5.5L4.5 9L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                        <path d="M5.5 5.5L9 9L15.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        ))}
                    </>
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
            <div className="border-t border-[var(--border-default)]">
                {isDispute && disputeResolved ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-4 text-sm text-[var(--text-muted)]">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        This dispute is resolved. The transcript is read-only.
                    </div>
                ) : (
                <>
                {isAdminViewer && (
                    <div className="flex items-center gap-1.5 px-4 pt-3 overflow-x-auto scrollbar-hide">
                        <Zap size={12} className="text-[var(--text-muted)] shrink-0" />
                        {ADMIN_QUICK_REPLIES.map((qr) => (
                            <button
                                key={qr.label}
                                type="button"
                                onClick={() => insertQuickReply(qr.text)}
                                className="shrink-0 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border-default)] rounded-full px-3 py-1.5 hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap"
                            >
                                {qr.label}
                            </button>
                        ))}
                    </div>
                )}
                {attachmentError && (
                    <div className="px-4 pt-3 text-xs text-red-400">{attachmentError}</div>
                )}
                <div className="flex gap-2 items-end p-4">
                    <input
                        ref={attachmentInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(event) => handlePhotoFile(event.target.files?.[0])}
                    />
                    <Button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={sending || uploadingAttachment}
                        shape="pill"
                        size="icon"
                        className="h-[46px] w-[46px] shrink-0"
                        title="Send photo"
                    >
                        {uploadingAttachment ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Paperclip className="h-4 w-4" />
                        )}
                    </Button>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                        disabled={sending || uploadingAttachment}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending || uploadingAttachment}
                        shape="pill"
                        size="icon"
                        className="h-[46px] w-[46px] shrink-0"
                        title="Send"
                    >
                        {sending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
                </>
                )}
            </div>
        </div>
    )
}
