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
let cachedUserId: string | null = null;
let cacheEpoch = 0;
const CACHE_MS = 30_000;

// Identity-scoped caching: a prior dealer account must never supply staff
// permissions or a verified status to the next person using the same device.
// Unscoped callers are always fetched fresh, never served shared cache data.
export async function getDealerAccess(force = false, userId?: string): Promise<DealerAccess> {
  if (userId && cachedUserId !== userId) {
    cachedUserId = userId;
    cachedAccess = null;
    cachedAt = 0;
    cacheEpoch += 1;
  }
  if (userId && !force && cachedAccess && Date.now() - cachedAt < CACHE_MS) {
    return cachedAccess;
  }

  const requestEpoch = cacheEpoch;
  const response = await apiClient<{ success: boolean; data: DealerAccess }>('/dealers/access');
  // An in-flight response from a previous login or a cleared session may
  // still resolve: return it to its original caller, but never recache it.
  if (userId && cachedUserId === userId && cacheEpoch === requestEpoch) {
    cachedAccess = response.data;
    cachedAt = Date.now();
  }
  return response.data;
}

export function clearDealerAccessCache() {
  cachedAccess = null;
  cachedAt = 0;
  cachedUserId = null;
  cacheEpoch += 1;
}
