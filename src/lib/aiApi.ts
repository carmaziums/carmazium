/**
 * API Client for AI (OpenAI) features
 */

import { apiClient } from './apiClient';

export interface AiFilterCard {
    label: string;
    params: Record<string, string>;
}

export interface AiSearchResult {
    text: string;
    filterCard?: AiFilterCard;
}

export interface AiChatResult {
    text: string;
    filterCard?: AiFilterCard;
}

/**
 * AI-powered search — send a natural-language car query
 * and get a recommendation + structured filters.
 */
export async function aiSearch(query: string): Promise<AiSearchResult> {
    const json = await apiClient<{ data: AiSearchResult }>('/ai/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
    });
    return json.data;
}

/**
 * AI chat — send conversation history and get a contextual response.
 */
export async function aiChat(
    messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<AiChatResult> {
    const json = await apiClient<{ data: AiChatResult }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
    });
    return json.data;
}

/**
 * AI description generator — sends vehicle data and gets a crafted listing description.
 */
export async function aiGenerateDescription(data: Record<string, any>): Promise<{ text: string }> {
    const json = await apiClient<{ data: { text: string } }>('/ai/generate-description', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return json.data;
}
