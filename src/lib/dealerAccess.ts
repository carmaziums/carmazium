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

export async function getDealerAccess(): Promise<DealerAccess> {
  const response = await apiClient<{ data: DealerAccess }>('/dealers/access');
  return response.data;
}
