import { apiClient } from './apiClient';

export type LegacyPartnerKind = 'finance' | 'insurance';

export interface LegacyPartnerStats {
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  totalValue: number;
}

export interface LegacyPartnerSettings {
  companyName: string;
  callbackUrl: string;
  isActive: boolean;
  isConfigured: boolean;
  apiKeyHint: string | null;
  integrationEnabled: boolean;
}

export interface LegacyPartnerKey {
  apiKey: string;
  apiKeyHint: string;
}

export interface PartnerApplicant {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface PartnerListingSummary {
  id: string;
  title: string;
  price: string;
  slug: string;
  images: string[];
  make: string | null;
  model: string | null;
  year: number | null;
}

export interface FinancePartnerApplication {
  id: string;
  listingId: string;
  userId: string;
  partnerId: string;
  depositAmount: string;
  termMonths: number;
  monthlyPayment: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  approvalDate: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: PartnerListingSummary;
  user?: PartnerApplicant;
}

export interface InsurancePartnerQuote {
  id: string;
  listingId: string;
  userId: string;
  partnerId: string;
  coverageType: string | null;
  quotedPrice: string | null;
  status: 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED';
  driverAge: number;
  ncbYears: number;
  hasConvictions: boolean;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: PartnerListingSummary;
  user?: PartnerApplicant;
}

export type LegacyPartnerItem = FinancePartnerApplication | InsurancePartnerQuote;

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface StandardResponse<T> {
  data: T;
}

const prefixFor = (kind: LegacyPartnerKind) => kind === 'finance' ? '/finance' : '/insurance';

export async function getLegacyPartnerItems(
  kind: LegacyPartnerKind,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<LegacyPartnerItem>> {
  return apiClient<PaginatedResponse<LegacyPartnerItem>>(
    `${prefixFor(kind)}/partner?page=${page}&limit=${limit}`,
  );
}

export async function getLegacyPartnerStats(kind: LegacyPartnerKind): Promise<LegacyPartnerStats> {
  const res = await apiClient<StandardResponse<LegacyPartnerStats>>(
    `${prefixFor(kind)}/partner/stats`,
  );
  return res.data;
}

export async function getLegacyPartnerSettings(kind: LegacyPartnerKind): Promise<LegacyPartnerSettings> {
  const res = await apiClient<StandardResponse<LegacyPartnerSettings>>(
    `${prefixFor(kind)}/partner/settings`,
  );
  return res.data;
}

export async function saveLegacyPartnerSettings(
  kind: LegacyPartnerKind,
  input: { companyName: string; callbackUrl?: string | null },
): Promise<LegacyPartnerSettings> {
  const res = await apiClient<StandardResponse<LegacyPartnerSettings>>(
    `${prefixFor(kind)}/partner/settings`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function regenerateLegacyPartnerKey(kind: LegacyPartnerKind): Promise<LegacyPartnerKey> {
  const res = await apiClient<StandardResponse<LegacyPartnerKey>>(
    `${prefixFor(kind)}/partner/api-key/regenerate`,
    { method: 'POST' },
  );
  return res.data;
}

export async function updateFinancePartnerApplication(
  applicationId: string,
  status: 'APPROVED' | 'REJECTED',
  monthlyPayment?: number,
): Promise<FinancePartnerApplication> {
  const res = await apiClient<StandardResponse<FinancePartnerApplication>>(
    `/finance/${applicationId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(monthlyPayment !== undefined ? { monthlyPayment } : {}),
      }),
    },
  );
  return res.data;
}

export async function updateInsurancePartnerQuote(
  quoteId: string,
  status: 'QUOTED' | 'REJECTED',
  quotedPrice?: number,
  coverageType?: string,
): Promise<InsurancePartnerQuote> {
  const res = await apiClient<StandardResponse<InsurancePartnerQuote>>(
    `/insurance/${quoteId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(quotedPrice !== undefined ? { quotedPrice } : {}),
        ...(coverageType ? { coverageType } : {}),
      }),
    },
  );
  return res.data;
}

export const formatPartnerCurrency = (value: number | string | null | undefined): string => {
  const amount = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(amount)) return '£0';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
};
