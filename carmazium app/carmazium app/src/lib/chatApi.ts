import { apiClient } from './apiClient';

export interface ChatUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  role?: string;
}

export interface ChatListing {
  id: string;
  title: string;
  slug: string;
  images: string[];
  type?: 'AUCTION' | 'CLASSIFIED';
  price?: number;
  auction?: {
    id: string;
    status: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
    winnerId: string | null;
    buyerFeePaid: boolean;
    winningBidAmount: number | null;
  } | null;
}

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  sender: ChatUser;
}

export interface ChatRoom {
  id: string;
  otherUser: ChatUser;
  listing: ChatListing | null;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    isRead: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ChatRoomsResponse {
  success: boolean;
  data: ChatRoom[];
}

export interface ChatMessagesResponse {
  success: boolean;
  data: ChatMessage[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Retrieves all chat rooms for the current authenticated user
 */
export async function getChatRooms(): Promise<ChatRoom[]> {
  const response = await apiClient<ChatRoomsResponse>('/chat/rooms', {
    method: 'GET',
  });
  return response.data;
}

/**
 * Creates or retrieves a chat room with another user
 */
export async function createChatRoom(participantId: string, listingId?: string): Promise<ChatRoom> {
  const response = await apiClient<{ data: ChatRoom }>('/chat/rooms', {
    method: 'POST',
    body: JSON.stringify({ participantId, listingId }),
  });
  return response.data;
}

/**
 * Fetches paginated chat messages for a specific room
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
    }
  );
}

/**
 * Dispatches a chat message (REST fallback)
 */
export async function sendChatMessage(roomId: string, content: string): Promise<ChatMessage> {
  const response = await apiClient<{ data: ChatMessage }>(`/chat/rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return response.data;
}

/**
 * Marks all messages in a specific chat room as read
 */
export async function markMessagesAsRead(roomId: string): Promise<number> {
  const response = await apiClient<{ data: { markedCount: number } }>(`/chat/rooms/${roomId}/read`, {
    method: 'PATCH',
  });
  return response.data.markedCount;
}

/**
 * Fetches the total count of unread messages for the user
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await apiClient<{ data: { count: number } }>('/chat/unread', {
      method: 'GET',
    });
    return response.data.count;
  } catch (e) {
    return 0;
  }
}

/**
 * Opens (or reuses) the user's support conversation with CarMazium.
 *
 * `POST /chat/support` finds-or-creates a room with the oldest ADMIN user and
 * joins both parties to it server-side (`chat.controller.ts:80-88`). Web has had
 * a "Contact Support" button in its sidebar for every role; a grep of mobile
 * `src/` for `chat/support` previously returned nothing, so mobile users had no
 * in-app route to support at all (DASH-024).
 *
 * Idempotent — calling it twice returns the same room, so it is safe to wire to
 * a button that people will inevitably double-tap.
 */
export async function getOrCreateSupportRoom(): Promise<{ id: string }> {
  const response = await apiClient<{ data: { id: string } }>('/chat/support', {
    method: 'POST',
  });
  return response.data;
}
