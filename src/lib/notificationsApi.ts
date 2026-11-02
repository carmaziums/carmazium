import { apiClient } from "./apiClient"

export interface AppNotification {
    id: string
    userId: string
    type: string
    title: string
    message: string
    body?: string
    isRead: boolean
    link?: string | null
    data?: Record<string, any> | null
    entityType?: string | null
    entityId?: string | null
    actionType?: string | null
    createdAt: string
}

export interface NotificationPage {
    notifications: AppNotification[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export async function getNotificationsPage(page = 1, limit = 20): Promise<NotificationPage> {
    const res = await apiClient<{
        data: AppNotification[]
        pagination?: {
            total?: number
            page?: number
            limit?: number
            totalPages?: number
        }
    }>(`/notifications?page=${page}&limit=${limit}`, {
        cache: 'no-store',
    })

    const safeData = res?.data ?? []
    const safeLimit = res?.pagination?.limit ?? limit
    const total = res?.pagination?.total ?? safeData.length
    return {
        notifications: safeData,
        total,
        page: res?.pagination?.page ?? page,
        limit: safeLimit,
        totalPages: res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, safeLimit))),
    }
}

export async function getNotifications(limit = 10): Promise<AppNotification[]> {
    try {
        const page = await getNotificationsPage(1, limit)
        return page.notifications
    } catch {
        return []
    }
}

export async function getUnreadNotificationCount(): Promise<number> {
    try {
        const res = await apiClient<{ data: { count: number } }>('/notifications/unread-count', {
            cache: 'no-store',
        })
        return res?.data?.count ?? 0
    } catch {
        return 0
    }
}

export async function markAllNotificationsRead(): Promise<void> {
    await apiClient('/notifications/read-all', { method: 'PATCH' })
}

export async function markNotificationRead(id: string): Promise<void> {
    await apiClient(`/notifications/${id}/read`, { method: 'PATCH' })
}

// ─── Icon helper — returns a lucide icon name based on notification type ───────
export function notificationIcon(type: string): string {
    const map: Record<string, string> = {
        OFFER_RECEIVED:        'Tag',
        OFFER_ACCEPTED:        'CheckCircle',
        OFFER_REJECTED:        'XCircle',
        OFFER_COUNTERED:       'RefreshCw',
        OFFER_WITHDRAWN:       'MinusCircle',
        NEW_MESSAGE:           'MessageSquare',
        MESSAGE_RECEIVED:      'MessageSquare',
        DEAL_CLOSED:           'CheckCircle',
        LISTING_SOLD:          'BadgeCheck',
        FINANCE_UPDATE:        'CreditCard',
        SYSTEM:                'Bell',
        // Auction types
        AUCTION_BID:           'Gavel',
        AUCTION_BID_PLACED:    'Gavel',
        AUCTION_OUTBID:        'TrendingDown',
        AUCTION_WON:           'Trophy',
        AUCTION_ENDED:         'Gavel',
        AUCTION_ENDED_NO_SALE: 'AlertCircle',
        AUCTION_STARTED:       'Zap',
        AUCTION_ENDING_SOON:   'Timer',
        AUCTION_CANCELLED:     'XCircle',
        AUCTION_RESERVE_MET:   'ShieldCheck',
    }
    return map[type] ?? 'Bell'
}
