import { getAccessToken } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium.onrender.com'
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'https://carmazium.onrender.com'

// Re-export getAccessToken for use in ChatContext
export { getAccessToken }


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

/**
 * Get all chat rooms for the current user
 */
export async function getChatRooms(): Promise<ChatRoom[]> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/chat/rooms`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch chat rooms' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}

/**
 * Create or find a chat room with another user
 */
export async function createChatRoom(participantId: string, listingId?: string): Promise<ChatRoom> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/chat/rooms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ participantId, listingId }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create chat room' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
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
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
        `${API_URL}/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            cache: 'no-store',
        }
    )

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch messages' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
}

/**
 * Send a message (HTTP fallback)
 */
export async function sendChatMessage(roomId: string, content: string): Promise<ChatMessage> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to send message' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(roomId: string): Promise<number> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/chat/rooms/${roomId}/read`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to mark as read' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data.markedCount
}

/**
 * Get total unread message count
 */
export async function getUnreadCount(): Promise<number> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/chat/unread`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        return 0  // Fail silently for unread count
    }

    const data = await response.json()
    return data.data.count
}

// ============================================================================
// WEBSOCKET URL HELPER
// ============================================================================

export function getWebSocketUrl(): string {
    return WS_URL
}
