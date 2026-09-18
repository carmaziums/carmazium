// Production rollout marker: chat moderation safety (PR #86).
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
    role?: string
}

export interface ChatListing {
    id: string
    title: string
    slug: string
    images: string[]
}

export type ChatDisputeStatus = 'OPEN' | 'RESOLVED'

export interface ChatDisputeCase {
    id: string
    sourceRoomId: string
    chatRoomId: string
    listingId: string
    buyerId: string
    sellerId: string
    openedById: string
    joinedAdminId?: string | null
    resolvedById?: string | null
    status: ChatDisputeStatus
    reason?: string | null
    adminJoinedAt?: string | null
    resolvedAt?: string | null
    createdAt: string
    updatedAt: string
    buyer?: ChatUser
    seller?: ChatUser
    joinedAdmin?: ChatUser | null
}

export interface ChatSourceDispute {
    id: string
    chatRoomId: string
    status: ChatDisputeStatus
}

export interface ChatMessage {
    id: string
    chatRoomId: string
    senderId: string
    clientMessageId?: string | null
    content: string
    attachmentPath?: string | null
    attachmentName?: string | null
    attachmentMime?: string | null
    attachmentSize?: number | null
    attachmentUrl?: string | null
    isRead: boolean
    createdAt: string
    updatedAt: string
    sender: ChatUser
    /** Local-only state used while a message is awaiting confirmation or retry. */
    deliveryStatus?: 'sending' | 'failed'
}

export interface ChatRoom {
    id: string
    context?: 'SUPPORT' | 'RETAIL' | 'AUCTION' | 'DISPUTE' | 'LEGACY'
    otherUser: ChatUser
    listing: ChatListing | null
    supportAssignedAdminId?: string | null
    supportAssignedAdmin?: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string
        profileImage?: string | null
    } | null
    supportTags?: string[]
    supportClosedAt?: string | null
    disputeCase?: ChatDisputeCase | null
    sourceDispute?: ChatSourceDispute | null
    canOpenDispute?: boolean
    chatBlocked?: boolean
    blockedByMe?: boolean
    blockReason?: string | null
    canBlockChat?: boolean
    canUnblockChat?: boolean
    needsReply?: boolean
    lastMessage: {
        id: string
        content: string
        attachmentPath?: string | null
        senderId: string
        isRead: boolean
        createdAt: string
    } | null
    unreadCount: number
    updatedAt: string
}

export type ChatReportReason =
    | 'HARASSMENT'
    | 'SCAM_FRAUD'
    | 'SPAM'
    | 'INAPPROPRIATE_CONTENT'
    | 'OTHER'

export interface ChatMessageReport {
    id: string
    chatRoomId: string
    messageId: string
    reporterId: string
    reportedUserId: string
    reason: ChatReportReason
    details?: string | null
    status: 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED'
    createdAt: string
}

export interface ChatAttachmentUploadTicket {
    bucket: string
    path: string
    token: string
    expiresInSeconds: number
}

export interface SendChatAttachmentPayload {
    path: string
    name: string
    mime: string
    size: number
    caption?: string
    clientMessageId?: string
}

export interface ChatRoomsResponse {
    success: boolean
    data: ChatRoom[]
}

export interface ChatRoomCursor {
    updatedAt: string
    id: string
}

export interface ChatRoomsPageResponse {
    success: boolean
    data: {
        rooms: ChatRoom[]
        pagination: {
            limit: number
            hasMore: boolean
            nextCursor: ChatRoomCursor | null
        }
    }
}

export interface ChatHistoryCursor {
    createdAt: string
    id: string
}

export interface ChatMessagesResponse {
    success: boolean
    data: ChatMessage[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
        hasMore?: boolean
        nextCursor?: ChatHistoryCursor | null
    }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * The official CarMazium support conversation always shows as "CarMazium",
 * not the individual admin account's real name — a single consistent
 * identity regardless of which staff member is actually behind it.
 */
export function isSupportUser(user: ChatUser | null | undefined): boolean {
    return user?.role === 'ADMIN'
}

export function getChatDisplayName(user: ChatUser | null | undefined): string {
    if (isSupportUser(user)) return 'CarMazium'
    if (!user) return 'Chat'
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Chat'
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

export async function getChatRoomsPage(
    cursor?: ChatRoomCursor | null,
    limit = 50,
): Promise<ChatRoomsPageResponse['data']> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) {
        params.set('before', cursor.updatedAt)
        params.set('beforeId', cursor.id)
    }

    const data = await apiClient<ChatRoomsPageResponse>(
        `/chat/rooms-page?${params.toString()}`,
        {
            method: 'GET',
            cache: 'no-store',
        },
    )
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
 * Get or create the current user's conversation with official CarMazium
 * support, without needing to know the support account's user ID.
 */
export async function getOrCreateSupportRoom(): Promise<ChatRoom> {
    const data = await apiClient<{ data: ChatRoom }>('/chat/support', {
        method: 'POST',
    })
    return data.data
}

export async function openVehicleDispute(
    sourceRoomId: string,
    reason?: string
): Promise<{
    room: ChatRoom
    dispute: ChatDisputeCase
    eventMessage: ChatMessage | null
    created: boolean
}> {
    const data = await apiClient<{ data: {
        room: ChatRoom
        dispute: ChatDisputeCase
        eventMessage: ChatMessage | null
        created: boolean
    } }>(`/chat/rooms/${sourceRoomId}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason?.trim() || undefined }),
    })
    return data.data
}

export async function blockChatRoom(
    roomId: string,
    reason?: string
): Promise<ChatRoom> {
    const data = await apiClient<{ data: ChatRoom }>(`/chat/rooms/${roomId}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason?.trim() || undefined }),
    })
    return data.data
}

export async function unblockChatRoom(roomId: string): Promise<ChatRoom> {
    const data = await apiClient<{ data: ChatRoom }>(`/chat/rooms/${roomId}/unblock`, {
        method: 'POST',
    })
    return data.data
}

export async function reportChatMessage(
    messageId: string,
    reason: ChatReportReason,
    details?: string
): Promise<{ report: ChatMessageReport; created: boolean }> {
    const data = await apiClient<{ data: { report: ChatMessageReport; created: boolean } }>(
        `/chat/messages/${messageId}/report`,
        {
            method: 'POST',
            body: JSON.stringify({
                reason,
                details: details?.trim() || undefined,
            }),
        }
    )
    return data.data
}

/**
 * Get messages for a chat room
 */
export async function getChatMessages(
    roomId: string,
    page = 1,
    limit = 50,
    cursor?: ChatHistoryCursor | null
): Promise<ChatMessagesResponse> {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    })
    if (cursor) {
        params.set('before', cursor.createdAt)
        params.set('beforeId', cursor.id)
    }

    return apiClient<ChatMessagesResponse>(
        `/chat/rooms/${roomId}/messages?${params.toString()}`,
        {
            method: 'GET',
            cache: 'no-store',
        }
    )
}

/**
 * Send a message (HTTP fallback)
 */
export async function sendChatMessage(
    roomId: string,
    content: string,
    clientMessageId?: string
): Promise<ChatMessage> {
    const data = await apiClient<{ data: ChatMessage }>(`/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, clientMessageId }),
    })
    return data.data
}

export async function createChatAttachmentUpload(
    roomId: string,
    file: { name: string; type: string; size: number }
): Promise<ChatAttachmentUploadTicket> {
    const data = await apiClient<{ data: ChatAttachmentUploadTicket }>(
        `/chat/rooms/${roomId}/attachments/upload-url`,
        {
            method: 'POST',
            body: JSON.stringify({
                name: file.name,
                mime: file.type,
                size: file.size,
            }),
        }
    )
    return data.data
}

export async function sendChatAttachment(
    roomId: string,
    payload: SendChatAttachmentPayload
): Promise<ChatMessage> {
    const data = await apiClient<{ data: ChatMessage }>(
        `/chat/rooms/${roomId}/attachments`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    )
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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

export function getWebSocketUrl(): string {
    return WS_URL
}
