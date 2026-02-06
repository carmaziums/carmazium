// Re-export getAccessToken for use in ChatContext
export { getAccessToken } from './supabase'


// ============================================================================
// CHAT TYPES
// ============================================================================

export interface ChatUser {
    id: string
    firstName: string | null
    lastName: string | null
    profileImage: string | null
}

export interface ChatListing {
    id: string
    title: string
    slug: string
    images: string[]
}

export interface ChatMessage {
    id: string
    chatRoomId: string
    senderId: string
    content: string
    isRead: boolean
    createdAt: string
    updatedAt: string
    sender: ChatUser
}

export interface ChatRoom {
    id: string
    otherUser: ChatUser
    listing: ChatListing | null
    lastMessage: {
        id: string
        content: string
        senderId: string
        isRead: boolean
        createdAt: string
    } | null
    unreadCount: number
    updatedAt: string
}

export interface ChatRoomsResponse {
    success: boolean
    data: ChatRoom[]
}

export interface ChatMessagesResponse {
    success: boolean
    data: ChatMessage[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

// ============================================================================
// CHAT REST API FUNCTIONS
// ============================================================================

import { apiClient } from './apiClient'

// ============================================================================
// CHAT REST API FUNCTIONS
// ============================================================================

/**
 * Get all chat rooms for the current user
 */
export async function getChatRooms(): Promise<ChatRoom[]> {
    const data = await apiClient<ChatRoomsResponse>('/chat/rooms', {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}

/**
 * Create or find a chat room with another user
 */
export async function createChatRoom(participantId: string, listingId?: string): Promise<ChatRoom> {
    const data = await apiClient<{ data: ChatRoom }>('/chat/rooms', {
        method: 'POST',
        body: JSON.stringify({ participantId, listingId }),
    })
    return data.data
}

/**
 * Get messages for a chat room
 */
export async function getChatMessages(
    roomId: string,
    page = 1,
    limit = 50
): Promise<ChatMessagesResponse> {
    return apiClient<ChatMessagesResponse>(
        `/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`,
        {
            method: 'GET',
            cache: 'no-store',
        }
    )
}

/**
 * Send a message (HTTP fallback)
 */
export async function sendChatMessage(roomId: string, content: string): Promise<ChatMessage> {
    const data = await apiClient<{ data: ChatMessage }>(`/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
    })
    return data.data
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(roomId: string): Promise<number> {
    const data = await apiClient<{ data: { markedCount: number } }>(`/chat/rooms/${roomId}/read`, {
        method: 'PATCH',
    })
    return data.data.markedCount
}

/**
 * Get total unread message count
 */
export async function getUnreadCount(): Promise<number> {
    try {
        const data = await apiClient<{ data: { count: number } }>('/chat/unread', {
            method: 'GET',
            cache: 'no-store',
        })
        return data.data.count
    } catch (e) {
        return 0
    }
}

// ============================================================================
// WEBSOCKET URL HELPER
// ============================================================================

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'https://carmazium.onrender.com'

export function getWebSocketUrl(): string {
    return WS_URL
}
