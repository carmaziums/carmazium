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

    // Actions
    refreshRooms: () => Promise<void>
    refreshUnreadCount: () => Promise<void>
    sendMessage: (roomId: string, content: string) => void
    startTyping: (roomId: string) => void
    stopTyping: (roomId: string) => void
    markAsRead: (roomId: string) => void

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
    const { user } = useAuth()
    const [rooms, setRooms] = useState<ChatRoom[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isConnected, setIsConnected] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const socketRef = useRef<Socket | null>(null)
    const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set())
    const typingCallbacks = useRef<Set<(data: any) => void>>(new Set())
    const readCallbacks = useRef<Set<(data: any) => void>>(new Set())

    // Initialize socket connection
    useEffect(() => {
        if (!user) {
            socketRef.current?.disconnect()
            socketRef.current = null
            setIsConnected(false)
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
                transports: ['websocket', 'polling'],
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
                // Update unread count for messages from others
                if (message.senderId !== user.id) {
                    setUnreadCount(prev => prev + 1)
                }
            })

            socket.on('user:typing', (data: any) => {
                typingCallbacks.current.forEach(cb => cb(data))
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
    }, [user])

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

    // Initial load
    useEffect(() => {
        if (user) {
            refreshRooms()
            refreshUnreadCount()
        }
    }, [user, refreshRooms, refreshUnreadCount])

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

    const markAsRead = useCallback((roomId: string) => {
        socketRef.current?.emit('message:read', { roomId })
        // Optimistically decrement unread count
        setUnreadCount(prev => Math.max(0, prev - 1))
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
        refreshRooms,
        refreshUnreadCount,
        sendMessage,
        startTyping,
        stopTyping,
        markAsRead,
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
