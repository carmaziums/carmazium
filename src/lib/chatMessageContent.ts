export const ADMIN_MEDIA_PREFIX = '__CARMAZIUM_ADMIN_MEDIA_V1__:'
export const DISPUTE_EVENT_PREFIX = '__CARMAZIUM_DISPUTE_EVENT_V1__:'

export type ChatMediaKind = 'IMAGE' | 'VIDEO'

export interface ParsedChatContent {
    text: string
    media: null | {
        url: string
        kind: ChatMediaKind
        name?: string | null
        mime?: string | null
        size?: number | null
    }
}

export function parseChatMessageContent(content: string): ParsedChatContent {
    if (!content?.startsWith(ADMIN_MEDIA_PREFIX)) {
        return { text: content || '', media: null }
    }

    try {
        const parsed = JSON.parse(content.slice(ADMIN_MEDIA_PREFIX.length))
        const media = parsed?.media
        if (!media?.url || !['IMAGE', 'VIDEO'].includes(media.kind)) {
            return { text: content, media: null }
        }
        return {
            text: typeof parsed.text === 'string' ? parsed.text : '',
            media: {
                url: String(media.url),
                kind: media.kind as ChatMediaKind,
                name: typeof media.name === 'string' ? media.name : null,
                mime: typeof media.mime === 'string' ? media.mime : null,
                size: typeof media.size === 'number' ? media.size : null,
            },
        }
    } catch {
        // Never hide a malformed/legacy message. If decoding fails, render it
        // as ordinary text exactly as the old chat did.
        return { text: content, media: null }
    }
}

export function chatMessagePreview(content: string): string {
    const disputeEvent = parseDisputeEventContent(content)
    if (disputeEvent) return disputeEventLabel(disputeEvent)

    const parsed = parseChatMessageContent(content)
    if (parsed.text.trim()) return parsed.text.trim()
    if (parsed.media?.kind === 'VIDEO') return 'Video from CarMazium'
    if (parsed.media?.kind === 'IMAGE') return 'Photo from CarMazium'
    return ''
}


export type DisputeEventType = 'OPENED' | 'ADMIN_JOINED' | 'RESOLVED'

export interface ParsedDisputeEvent {
    type: DisputeEventType
    disputeId?: string
    reason?: string | null
}

export function parseDisputeEventContent(content: string): ParsedDisputeEvent | null {
    if (!content?.startsWith(DISPUTE_EVENT_PREFIX)) return null

    try {
        const parsed = JSON.parse(content.slice(DISPUTE_EVENT_PREFIX.length))
        if (!['OPENED', 'ADMIN_JOINED', 'RESOLVED'].includes(parsed?.type)) {
            return null
        }

        return {
            type: parsed.type as DisputeEventType,
            disputeId: typeof parsed.disputeId === 'string' ? parsed.disputeId : undefined,
            reason: typeof parsed.reason === 'string' ? parsed.reason : null,
        }
    } catch {
        return null
    }
}

export function disputeEventLabel(event: ParsedDisputeEvent): string {
    switch (event.type) {
        case 'OPENED':
            return event.reason?.trim()
                ? `Dispute opened: ${event.reason.trim()}`
                : 'A vehicle dispute was opened.'
        case 'ADMIN_JOINED':
            return 'CarMazium joined this dispute.'
        case 'RESOLVED':
            return 'CarMazium marked this dispute as resolved.'
    }
}
