export const ADMIN_MEDIA_PREFIX = '__CARMAZIUM_ADMIN_MEDIA_V1__:'

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
    const parsed = parseChatMessageContent(content)
    if (parsed.text.trim()) return parsed.text.trim()
    if (parsed.media?.kind === 'VIDEO') return 'Video from CarMazium'
    if (parsed.media?.kind === 'IMAGE') return 'Photo from CarMazium'
    return ''
}
