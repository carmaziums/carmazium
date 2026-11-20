type ScrollMessage = {
    id: string
    clientMessageId?: string | null
    senderId: string
    aiGenerated?: boolean
    deliveryStatus?: string
}

/** Keep the reading position from before a message changes the DOM height. */
export class ChatScrollTracker {
    following = true
    private roomId: string | null = null
    private tailKey: string | null = null

    onScroll(top: number, height: number, viewport: number) {
        this.following = height - top - viewport < 150
    }

    update(roomId: string, tail: ScrollMessage | undefined, userId: string | undefined, support: boolean) {
        // Acknowledging an optimistic send must not look like another message.
        const key = tail ? tail.clientMessageId || tail.id : null
        const initial = this.roomId !== roomId
        const appended = key !== this.tailKey
        this.roomId = roomId
        this.tailKey = key
        if (!initial && !appended) return false

        const own = !!tail && (!!tail.deliveryStatus || tail.senderId === userId)
        const answer = !!tail?.aiGenerated && support
        if (initial || own || answer) this.following = true
        return this.following
    }
}
