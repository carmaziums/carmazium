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

export type DealerStaffRole = 'OWNER' | 'ADMIN' | 'SALES_AGENT' | 'FINANCE_MANAGER';

export interface DealerAccess {
  ownerUserId: string;
  dealerProfileId: string;
  isOwner: boolean;
  role: DealerStaffRole;
  isVerified: boolean;
  permissions: DealerPermission[];
}

export async function getDealerAccess(): Promise<DealerAccess> {
  const res = await apiClient<{ data: DealerAccess }>('/dealers/access');
  return res.data;
}

export function dealerHasPermission(
  access: DealerAccess | null | undefined,
  permission: DealerPermission,
): boolean {
  return !!access?.permissions?.includes(permission);
}
