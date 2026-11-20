import type { ChatMessage } from './chatApi'

/** Colour describes the author, not which side of the inbox is viewing it. */
export function chatMessageAppearance(message: Pick<ChatMessage, 'aiGenerated' | 'sender' | 'deliveryStatus'>, adminViewer: boolean) {
    if (message.aiGenerated) return {
        kind: 'ai',
        bubble: 'bg-[#dbeafe] text-[#172554] dark:bg-[#172554] dark:text-[#eff6ff]',
    }
    if (message.sender?.role === 'ADMIN' || (message.deliveryStatus && adminViewer)) return {
        kind: 'admin',
        bubble: 'bg-[#b91c1c] text-[#ffffff] dark:bg-[#b91c1c] dark:text-[#ffffff]',
    }
    return {
        kind: 'customer',
        bubble: 'bg-[#e2e8f0] text-[#0f172a] dark:bg-[#334155] dark:text-[#f8fafc]',
    }
}
