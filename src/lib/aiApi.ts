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
    const json = await apiClient<{ data: { id: string; status: string } }>('/ai/report', {
        method: 'POST',
        body: JSON.stringify({
            surface: 'WEB',
            prompt: payload.prompt,
            response: payload.response,
            reason: payload.reason,
            details: payload.details,
        }),
    });
    return json.data;
}


export type AiReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

export interface AdminAiReport {
    id: string;
    surface: string;
    prompt?: string | null;
    response: string;
    reason: AiReportReason;
    details?: string | null;
    status: AiReportStatus;
    reviewedById?: string | null;
    reviewedAt?: string | null;
    adminNote?: string | null;
    createdAt: string;
    updatedAt: string;
}

export async function getAdminAiReports(
    page = 1,
    limit = 30,
    status?: AiReportStatus | '',
): Promise<{
    data: AdminAiReport[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });
    if (status) params.set('status', status);

    const json = await apiClient<{
        data: {
            data: AdminAiReport[];
            pagination: { total: number; page: number; limit: number; totalPages: number };
        };
    }>(`/ai/admin/reports?${params.toString()}`);
    return json.data;
}

export async function updateAdminAiReport(
    reportId: string,
    status: AiReportStatus,
    adminNote?: string,
): Promise<AdminAiReport> {
    const json = await apiClient<{ data: AdminAiReport }>(
        `/ai/admin/reports/${reportId}`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                status,
                adminNote: adminNote?.trim() || undefined,
            }),
        },
    );
    return json.data;
}
