import { apiClient } from './apiClient';

export type DealerPermission =
  | 'VIEW_TRADE'
  | 'PLACE_BID'
  | 'PAY_AUCTION_FEE'
  | 'PAY_LISTING_FEE'
  | 'MANAGE_CRM'
  | 'MANAGE_OFFERS'
  | 'VIEW_INVENTORY'
  | 'MANAGE_INVENTORY'
  | 'MANAGE_FINANCE'
  | 'VIEW_PURCHASES'
  | 'VIEW_ANALYTICS'
  | 'MANAGE_TEAM'
  | 'MANAGE_KYC';

export type DealerBusinessRole = 'OWNER' | 'ADMIN' | 'SALES_AGENT' | 'FINANCE_MANAGER';

export interface DealerAccess {
  ownerUserId: string;
  dealerProfileId: string;
  isOwner: boolean;
  role: DealerBusinessRole;
  isVerified: boolean;
  permissions: DealerPermission[];
}

let cachedAccess: DealerAccess | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export async function getDealerAccess(force = false): Promise<DealerAccess> {
  if (!force && cachedAccess && Date.now() - cachedAt < CACHE_MS) {
    return cachedAccess;
  }

  const response = await apiClient<{ success: boolean; data: DealerAccess }>('/dealers/access');
  cachedAccess = response.data;
  cachedAt = Date.now();
  return response.data;
}

export function clearDealerAccessCache() {
  cachedAccess = null;
  cachedAt = 0;
}
