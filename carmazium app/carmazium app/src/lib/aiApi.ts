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


export type AiReportReason =
  | 'UNSAFE_OFFENSIVE'
  | 'INACCURATE_MISLEADING'
  | 'SCAM_DISHONEST'
  | 'OTHER';

export async function reportAiResponse(payload: {
  prompt?: string;
  response: string;
  reason: AiReportReason;
  details?: string;
}): Promise<{ id: string; status: string }> {
  const res = await apiClient<{ success: boolean; data: { id: string; status: string } }>(
    '/ai/report',
    {
      method: 'POST',
      body: JSON.stringify({
        surface: 'NATIVE',
        prompt: payload.prompt,
        response: payload.response,
        reason: payload.reason,
        details: payload.details,
      }),
    },
  );
  return res.data;
}
