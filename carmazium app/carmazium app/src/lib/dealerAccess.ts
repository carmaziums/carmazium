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

export type DealerBusinessRole =
  | 'OWNER'
  | 'ADMIN'
  | 'SALES_AGENT'
  | 'FINANCE_MANAGER';

export interface DealerAccess {
  ownerUserId: string;
  dealerProfileId: string;
  isOwner: boolean;
  role: DealerBusinessRole;
  isVerified: boolean;
  permissions: DealerPermission[];
}

export async function getDealerAccess(): Promise<DealerAccess> {
  const response = await apiClient<{ success: boolean; data: DealerAccess }>('/dealers/access');
  return response.data;
}

export function hasDealerPermission(
  access: DealerAccess | null | undefined,
  permission?: DealerPermission | null,
): boolean {
  if (!permission) return true;
  return Boolean(access?.permissions?.includes(permission));
}
