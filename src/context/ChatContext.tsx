"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import {
    getChatRoomsPage,
    getUnreadCount,
    getAccessToken,
    type ChatRoom,
    type ChatRoomCursor,
    type ChatMessage,
    getWebSocketUrl
} from '@/lib/chatApi'


// ============================================================================
// TYPES
// ============================================================================

interface ChatContextType {
    // State
    rooms: ChatRoom[]
    unreadCount: number
    isConnected: boolean
    isLoading: boolean
    hasMoreRooms: boolean
    isLoadingMoreRooms: boolean
    /** User IDs of conversation partners who currently have a live connection. */
    onlineUserIds: Set<string>

    // Actions
    refreshRooms: () => Promise<void>
    loadMoreRooms: () => Promise<void>
    refreshUnreadCount: () => Promise<void>
    sendMessage: (roomId: string, content: string, clientMessageId: string) => Promise<ChatMessage>
    startTyping: (roomId: string) => void
    stopTyping: (roomId: string) => void
    joinRoom: (roomId: string) => void
    markAsRead: (roomId: string, notifyServer?: boolean) => void
    setActiveRoom: (roomId: string | null) => void
    upsertRoom: (room: ChatRoom) => void

    // Event subscriptions
    onNewMessage: (callback: (message: ChatMessage) => void) => () => void
    onTyping: (callback: (data: { roomId: string; userId: string; isTyping: boolean }) => void) => () => void
    onMessagesRead: (callback: (data: { roomId: string; readBy: string }) => void) => () => void
    onRoomUpdated: (callback: (room: ChatRoom) => void) => () => void
}

type ChatSendAck =
    | { ok: true; message: ChatMessage; duplicate: boolean }
    | { ok: false; error: { code: string; message: string } }

function chatSendError(code: string, message: string): Error & { code: string } {
    const error = new Error(message) as Error & { code: string }
    error.code = code
    return error
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

// ============================================================================
// PROVIDER
// ============================================================================

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { user, profile, loading: authLoading } = useAuth()
    const [rooms, setRooms] = useState<ChatRoom[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isConnected, setIsConnected] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [hasMoreRooms, setHasMoreRooms] = useState(false)
    const [isLoadingMoreRooms, setIsLoadingMoreRooms] = useState(false)
    const [roomCursor, setRoomCursor] = useState<ChatRoomCursor | null>(null)
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

    const socketRef = useRef<Socket | null>(null)
    const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set())
    const typingCallbacks = useRef<Set<(data: any) => void>>(new Set())
    const readCallbacks = useRef<Set<(data: any) => void>>(new Set())
    const roomUpdateCallbacks = useRef<Set<(room: ChatRoom) => void>>(new Set())
    const activeRoomIdRef = useRef<string | null>(null)
    const hasInitiallyLoaded = useRef(false)

    // Initialize socket connection — only after profile is loaded (backend session confirmed)
    useEffect(() => {
        if (!user || !profile) {
            socketRef.current?.disconnect()
            socketRef.current = null
            setIsConnected(false)
            setOnlineUserIds(new Set())
            activeRoomIdRef.current = null
            hasInitiallyLoaded.current = false
            return
        }

        let socket: Socket | null = null

        const connectSocket = async () => {
            const token = await getAccessToken()
            if (!token) {
                console.warn('No token available for WebSocket connection')
                return
            }

            socket = io(`${getWebSocketUrl()}/chat`, {
                auth: { token },
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            })

            socket.on('connect', () => {
                console.log('Chat connected')
                setIsConnected(true)
            })

            socket.on('disconnect', async (reason) => {
                console.log('Chat disconnected')
                setIsConnected(false)

                // A server-side authentication rejection uses "io server disconnect",
                // which Socket.IO does not automatically reconnect. Refresh the
                // Supabase token before explicitly reconnecting so a long-lived tab
                // can recover after its original JWT expires.
                if (reason === 'io server disconnect') {
                    const freshToken = await getAccessToken().catch(() => null)
                    if (freshToken && socket) {
                        socket.auth = { token: freshToken }
                        socket.connect()
                    }
                }
            })

            socket.on('message:new', (message: ChatMessage) => {
                messageCallbacks.current.forEach(cb => cb(message))
                const incomingFromOther = message.senderId !== user.id
                const roomIsActive = activeRoomIdRef.current === message.chatRoomId

                // Messages already visible in the open conversation must not create
                // a transient/stuck unread badge.
                if (incomingFromOther && !roomIsActive) {
                    setUnreadCount(prev => prev + 1)
                }
                // Optimistically move the affected room to the top with updated last-message preview
                setRooms(prev => {
                    const idx = prev.findIndex(r => r.id === message.chatRoomId)
                    if (idx === -1) {
                        // First message of a conversation we don't have yet (someone just
                        // started a brand-new chat with us) — a per-message patch has
                        // nothing to update, so pull the real room record instead of
                        // silently dropping the event until the next manual refresh.
                        getChatRoomsPage().then((page) => {
                            setRooms(current => {
                                const byId = new Map(current.map(room => [room.id, room]))
                                for (const room of page.rooms) byId.set(room.id, room)
                                return Array.from(byId.values())
                                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                            })
                        }).catch(() => { })
                        return prev
                    }
                    const updated = {
                        ...prev[idx],
                        lastMessage: {
                            id: message.id,
                            content: message.content,
                            senderId: message.senderId,
                            isRead: false,
                            createdAt: message.createdAt,
                        },
                        unreadCount: incomingFromOther && !roomIsActive
                            ? prev[idx].unreadCount + 1
                            : prev[idx].unreadCount,
                        updatedAt: message.createdAt,
                    }
                    const rest = prev.filter((_, i) => i !== idx)
                    return [updated, ...rest]
                })
            })

            socket.on('user:typing', (data: any) => {
                typingCallbacks.current.forEach(cb => cb(data))
            })

            socket.on('presence:snapshot', (data: { onlineUserIds: string[] }) => {
                setOnlineUserIds(new Set(data.onlineUserIds))
            })

            socket.on('presence:update', (data: { userId: string; online: boolean }) => {
                setOnlineUserIds(prev => {
                    const next = new Set(prev)
                    if (data.online) next.add(data.userId)
                    else next.delete(data.userId)
                    return next
                })
            })

            socket.on('messages:read', (data: any) => {
                readCallbacks.current.forEach(cb => cb(data))
            })

            socket.on('room:updated', (room: ChatRoom) => {
                setRooms(current => {
                    const index = current.findIndex(item => item.id === room.id)
                    if (index === -1) return [room, ...current]
                    const next = [...current]
                    next[index] = { ...next[index], ...room }
                    return next
                })
                roomUpdateCallbacks.current.forEach(cb => cb(room))
            })

            socket.on('error', (error: any) => {
                console.error('Chat socket error:', error)
            })

            socketRef.current = socket
        }

        connectSocket()

        return () => {
            socket?.disconnect()
            socketRef.current = null
        }
    }, [user, profile])

    // Fetch rooms and unread count
    const refreshRooms = useCallback(async () => {
        if (!user) return
        try {
            setIsLoading(true)
            const page = await getChatRoomsPage()
            setRooms(page.rooms)
            setHasMoreRooms(page.pagination.hasMore)
            setRoomCursor(page.pagination.nextCursor)
        } catch (error) {
            console.error('Failed to fetch rooms:', error)
        } finally {
            setIsLoading(false)
        }
    }, [user])

    const loadMoreRooms = useCallback(async () => {
        if (!user || !roomCursor || !hasMoreRooms || isLoadingMoreRooms) return
        try {
            setIsLoadingMoreRooms(true)
            const page = await getChatRoomsPage(roomCursor)
            setRooms(current => {
                const existing = new Set(current.map(room => room.id))
                return [...current, ...page.rooms.filter(room => !existing.has(room.id))]
            })
            setHasMoreRooms(page.pagination.hasMore)
            setRoomCursor(page.pagination.nextCursor)
        } catch (error) {
            console.error('Failed to load older chat rooms:', error)
        } finally {
            setIsLoadingMoreRooms(false)
        }
    }, [user, roomCursor, hasMoreRooms, isLoadingMoreRooms])

    const refreshUnreadCount = useCallback(async () => {
        if (!user) return
        try {
            const count = await getUnreadCount()
            setUnreadCount(count)
        } catch (error) {
            console.error('Failed to fetch unread count:', error)
        }
    }, [user])

    // Initial load only after backend session is ready (profile loaded) to avoid 401s.
    // Guard with hasInitiallyLoaded to prevent re-fetching on token refresh or socket reconnect
    // (socket events keep rooms/unread in sync after the first load).
    useEffect(() => {
        if (user && profile && !authLoading && !hasInitiallyLoaded.current) {
            hasInitiallyLoaded.current = true
            refreshRooms()
            refreshUnreadCount()
        }
    }, [user, profile, authLoading, refreshRooms, refreshUnreadCount])

    // Socket actions
    const sendMessage = useCallback((
        roomId: string,
        content: string,
        clientMessageId: string,
    ): Promise<ChatMessage> => {
        return new Promise((resolve, reject) => {
            const socket = socketRef.current
            if (!socket?.connected) {
                reject(chatSendError(
                    'SOCKET_UNAVAILABLE',
                    'Live chat connection is unavailable.',
                ))
                return
            }

            socket.timeout(8000).emit(
                'message:send',
                { roomId, content, clientMessageId },
                (timeoutError: Error | null, response: ChatSendAck) => {
                    if (timeoutError) {
                        reject(chatSendError(
                            'CHAT_ACK_TIMEOUT',
                            'Message confirmation timed out.',
                        ))
                        return
                    }

                    if (!response?.ok) {
                        reject(chatSendError(
                            response?.error?.code || 'SEND_FAILED',
                            response?.error?.message || 'Message could not be sent.',
                        ))
                        return
                    }

                    resolve(response.message)
                },
            )
        })
    }, [])

    const startTyping = useCallback((roomId: string) => {
        socketRef.current?.emit('typing:start', { roomId })
    }, [])

    const stopTyping = useCallback((roomId: string) => {
        socketRef.current?.emit('typing:stop', { roomId })
    }, [])

    const joinRoom = useCallback((roomId: string) => {
        socketRef.current?.emit('room:join', { roomId })
    }, [])

    const setActiveRoom = useCallback((roomId: string | null) => {
        activeRoomIdRef.current = roomId
    }, [])

    const upsertRoom = useCallback((room: ChatRoom) => {
        setRooms(prev => {
            const idx = prev.findIndex(r => r.id === room.id)
            if (idx !== -1) {
                const next = [...prev]
                next[idx] = room
                return next
            }
            return [room, ...prev]
        })
    }, [])

    const markAsRead = useCallback((roomId: string, notifyServer = true) => {
        if (notifyServer) {
            socketRef.current?.emit('message:read', { roomId })
        }
        // Zero out this room's badge and subtract its exact count from the global total
        setRooms(prev => {
            const idx = prev.findIndex(r => r.id === roomId)
            if (idx === -1) return prev
            const roomUnread = prev[idx].unreadCount
            if (roomUnread === 0) return prev
            setUnreadCount(c => Math.max(0, c - roomUnread))
            const next = [...prev]
            next[idx] = { ...next[idx], unreadCount: 0 }
            return next
        })
    }, [])

    // Event subscriptions
    const onNewMessage = useCallback((callback: (message: ChatMessage) => void) => {
        messageCallbacks.current.add(callback)
        return () => {
            messageCallbacks.current.delete(callback)
        }
    }, [])

    const onTyping = useCallback((callback: (data: any) => void) => {
        typingCallbacks.current.add(callback)
        return () => {
            typingCallbacks.current.delete(callback)
        }
    }, [])

    const onMessagesRead = useCallback((callback: (data: any) => void) => {
        readCallbacks.current.add(callback)
        return () => {
            readCallbacks.current.delete(callback)
        }
    }, [])

    const onRoomUpdated = useCallback((callback: (room: ChatRoom) => void) => {
        roomUpdateCallbacks.current.add(callback)
        return () => {
            roomUpdateCallbacks.current.delete(callback)
        }
    }, [])

    const value: ChatContextType = {
        rooms,
        unreadCount,
        isConnected,
        isLoading,
        hasMoreRooms,
        isLoadingMoreRooms,
        onlineUserIds,
        refreshRooms,
        loadMoreRooms,
        refreshUnreadCount,
        sendMessage,
        startTyping,
        stopTyping,
        joinRoom,
        markAsRead,
        setActiveRoom,
        upsertRoom,
        onNewMessage,
        onTyping,
        onMessagesRead,
        onRoomUpdated,
    }

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    )
}

// ============================================================================
// HOOK
// ============================================================================

export function useChat() {
    const context = useContext(ChatContext)
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider')
    }
    return context
}
