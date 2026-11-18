import { classifySupportMessage, hasSensitiveSupportContent } from './mazium-support-policy';

export type SupportConversationTurn = { role: 'user' | 'assistant'; content: string };

/** Bounded, same-room text only. Do not forward private details from older turns. */
export function safeSupportConversation(
    history: { content: string | null; senderId: string; aiGenerated: boolean }[],
    customerId: string,
    latest: string,
): SupportConversationTurn[] {
    let turns: SupportConversationTurn[] = [];
    for (const message of history) {
        const content = message.content?.trim();
        if (!content) continue;
        if (hasSensitiveSupportContent(content) || content.length > 4000) {
            // Start a new context after protected content, including replies
            // which could repeat it. Never echo sensitive history to the model.
            turns = [];
            continue;
        }
        if (message.senderId === customerId && !message.aiGenerated) {
            if (classifySupportMessage(content).action === 'DRAFT') turns.push({ role: 'user', content });
        } else if (message.aiGenerated && turns.length) {
            turns.push({ role: 'assistant', content });
        }
    }
    if (turns.at(-1)?.role !== 'user' || turns.at(-1)?.content !== latest.trim()) {
        if (classifySupportMessage(latest).action === 'DRAFT') turns.push({ role: 'user', content: latest.trim() });
    }
    return turns.slice(-40);
}
