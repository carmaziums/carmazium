import { apiClient } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinanceApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface FinanceApplication {
  id: string;
  listingId: string;
  depositAmount: number;
  termMonths: number;
  monthlyPayment: number | null;
  status: FinanceApplicationStatus;
  approvalDate: string | null;
  createdAt: string;
  listing?: {
    title: string;
    make: string;
    model: string;
    price: number;
  };
}

interface FinanceApplicationsResponse {
  success: boolean;
  data: FinanceApplication[];
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getMyFinanceApplications(): Promise<FinanceApplication[]> {
  const res = await apiClient<FinanceApplicationsResponse>('/finance/my?page=1&limit=100');
  return Array.isArray(res?.data) ? res.data : [];
}
