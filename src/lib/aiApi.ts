/**
 * API Client for AI (OpenAI) features
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

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
    const response = await fetch(`${API_URL}/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        throw new Error(`AI search request failed: ${response.status}`);
    }

    const json = await response.json();
    return json.data as AiSearchResult;
}

/**
 * AI chat — send conversation history and get a contextual response.
 */
export async function aiChat(
    messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<AiChatResult> {
    const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
        throw new Error(`AI chat request failed: ${response.status}`);
    }

    const json = await response.json();
    return json.data as AiChatResult;
}
