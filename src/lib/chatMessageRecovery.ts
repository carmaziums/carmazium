import type { ChatMessage } from './chatApi'

/** Reconcile the newest REST page without losing loaded history or pending sends. */
export function reconcileChatMessages(current: ChatMessage[], incoming: ChatMessage[], roomId: string): ChatMessage[] {
    const messages = current.filter(message => message.chatRoomId === roomId)
    let changed = messages.length !== current.length
    for (const message of incoming) {
        if (message.chatRoomId !== roomId) continue
        const index = messages.findIndex(existing => existing.id === message.id ||
            (message.clientMessageId && existing.clientMessageId === message.clientMessageId &&
                (existing.senderId === message.senderId ||
                    (existing.senderId === 'optimistic' && Boolean(existing.deliveryStatus)))))
        if (index < 0) {
            messages.push(message)
            changed = true
            continue
        }
        const existing = messages[index]
        // A slower REST response must not overwrite a newer socket update.
        if (!existing.deliveryStatus && Date.parse(existing.updatedAt) > Date.parse(message.updatedAt)) continue
        const confirmed = { ...message, isRead: existing.isRead || message.isRead }
        if (JSON.stringify(existing) !== JSON.stringify(confirmed)) {
            messages[index] = confirmed
            changed = true
        }
    }
    if (!changed) return current
    return messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
}
