"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import {
    getChatRooms,
    getUnreadCount,
    getAccessToken,
    type ChatRoom,
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
    /** User IDs of conversation partners who currently have a live connection. */
    onlineUserIds: Set<string>

    // Actions
    refreshRooms: () => Promise<void>
    refreshUnreadCount: () => Promise<void>
    sendMessage: (roomId: string, content: string) => void
    startTyping: (roomId: string) => void
    stopTyping: (roomId: string) => void
    markAsRead: (roomId: string) => void
    upsertRoom: (room: ChatRoom) => void

    // Event subscriptions
    onNewMessage: (callback: (message: ChatMessage) => void) => () => void
    onTyping: (callback: (data: { roomId: string; userId: string; isTyping: boolean }) => void) => () => void
    onMessagesRead: (callback: (data: { roomId: string; readBy: string }) => void) => () => void
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
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

    const socketRef = useRef<Socket | null>(null)
    const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set())
    const typingCallbacks = useRef<Set<(data: any) => void>>(new Set())
    const readCallbacks = useRef<Set<(data: any) => void>>(new Set())
    const hasInitiallyLoaded = useRef(false)

    // Initialize socket connection — only after profile is loaded (backend session confirmed)
    useEffect(() => {
        if (!user || !profile) {
            socketRef.current?.disconnect()
            socketRef.current = null
            setIsConnected(false)
            setOnlineUserIds(new Set())
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

            socket.on('disconnect', () => {
                console.log('Chat disconnected')
                setIsConnected(false)
            })

            socket.on('message:new', (message: ChatMessage) => {
                messageCallbacks.current.forEach(cb => cb(message))
                // Update unread count + room list preview for messages from others
                if (message.senderId !== user.id) {
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
                        getChatRooms().then(setRooms).catch(() => { })
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
                        unreadCount: message.senderId !== user.id
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
            const data = await getChatRooms()
            setRooms(data)
        } catch (error) {
            console.error('Failed to fetch rooms:', error)
        } finally {
            setIsLoading(false)
        }
    }, [user])

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
    const sendMessage = useCallback((roomId: string, content: string) => {
        socketRef.current?.emit('message:send', { roomId, content })
    }, [])

    const startTyping = useCallback((roomId: string) => {
        socketRef.current?.emit('typing:start', { roomId })
    }, [])

    const stopTyping = useCallback((roomId: string) => {
        socketRef.current?.emit('typing:stop', { roomId })
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

    const markAsRead = useCallback((roomId: string) => {
        socketRef.current?.emit('message:read', { roomId })
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

    const value: ChatContextType = {
        rooms,
        unreadCount,
        isConnected,
        isLoading,
        onlineUserIds,
        refreshRooms,
        refreshUnreadCount,
        sendMessage,
        startTyping,
        stopTyping,
        markAsRead,
        upsertRoom,
        onNewMessage,
        onTyping,
        onMessagesRead,
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
