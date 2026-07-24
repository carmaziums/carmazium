import { apiClient } from './apiClient';

export interface MarketingPopupConfig {
    id: string;
    enabled: boolean;
    imageUrl: string | null;
    linkUrl: string;
    updatedAt: string;
    updatedBy: string | null;
}

/** Public — safe to call for anonymous visitors, no auth required. */
export async function getMarketingPopupConfig(): Promise<MarketingPopupConfig> {
    const res = await apiClient<{ success: boolean; data: MarketingPopupConfig }>('/marketing-popup');
    return res.data;
}

/** Admin only — backend rejects this for non-admins. */
export async function updateMarketingPopupConfig(
    update: Partial<Pick<MarketingPopupConfig, 'enabled' | 'imageUrl' | 'linkUrl'>>,
): Promise<MarketingPopupConfig> {
    const res = await apiClient<{ success: boolean; data: MarketingPopupConfig }>('/marketing-popup', {
        method: 'PATCH',
        body: JSON.stringify(update),
    });
    return res.data;
}
