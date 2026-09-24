import { apiClient } from './apiClient';

export interface FinanceApplication {
  id: string;
  depositAmount: string;
  termMonths: number;
  monthlyPayment: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  createdAt: string;
  listing?: { id: string; title: string; price: string; make?: string | null; model?: string | null; year?: number | null };
  user?: { id: string; firstName?: string | null; lastName?: string | null; email: string };
}

export interface InsuranceQuote {
  id: string;
  coverageType: string | null;
  quotedPrice: string | null;
  status: 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED';
  driverAge: number;
  ncbYears: number;
  hasConvictions: boolean;
  createdAt: string;
  listing?: { id: string; title: string; price: string; make?: string | null; model?: string | null; year?: number | null };
  user?: { id: string; firstName?: string | null; lastName?: string | null; email: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function getFinancePartnerApplications(page = 1, limit = 50): Promise<PaginatedResponse<FinanceApplication>> {
  return apiClient<PaginatedResponse<FinanceApplication>>(`/finance/partner?page=${page}&limit=${limit}`);
}

export async function updateFinancePartnerApplication(id: string, status: FinanceApplication['status']): Promise<FinanceApplication> {
  const r = await apiClient<{ data: FinanceApplication }>(`/finance/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return r.data;
}

export async function getInsurancePartnerQuotes(page = 1, limit = 50): Promise<PaginatedResponse<InsuranceQuote>> {
  return apiClient<PaginatedResponse<InsuranceQuote>>(`/insurance/partner?page=${page}&limit=${limit}`);
}

export async function updateInsurancePartnerQuote(id: string, status: InsuranceQuote['status']): Promise<InsuranceQuote> {
  const r = await apiClient<{ data: InsuranceQuote }>(`/insurance/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return r.data;
}
