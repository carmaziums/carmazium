import { apiClient } from './apiClient';

export interface AiFilterCard {
  label: string;
  params: Record<string, string>;
}

export interface AiChatResult {
  text: string;
  filterCard?: AiFilterCard | null;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendAiChatMessage(messages: AiChatMessage[]): Promise<AiChatResult> {
  const res = await apiClient<{ success: boolean; data: AiChatResult }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
  return res.data;
}

export interface AiSearchResult {
  text: string;
  filterCard?: AiFilterCard | null;
}

export async function naturalLanguageSearch(query: string): Promise<AiSearchResult> {
  const res = await apiClient<{ success: boolean; data: AiSearchResult }>('/ai/search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  return res.data;
}
