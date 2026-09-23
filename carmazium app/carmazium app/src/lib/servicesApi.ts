import { apiClient } from './apiClient';

export type ServiceType = 'DELIVERY' | 'INSPECTION' | 'FINANCE' | 'WARRANTY';
export type CapabilityStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export const SERVICE_LABELS: Record<ServiceType, string> = {
  DELIVERY: 'Delivery & Recovery',
  INSPECTION: 'Vehicle Inspections',
  FINANCE: 'Vehicle Finance',
  WARRANTY: 'Warranty Providers',
};

export interface ContractorCapability {
  id: string;
  contractorId: string;
  serviceType: ServiceType;
  status: CapabilityStatus;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  verificationStatus: string;
  verificationCompletedAt: string | null;
  verificationExpiresAt: string | null;
  jobNationwide: boolean;
  jobPostcodeAreas: string[];
  leadNationwide: boolean;
  leadPostcodeAreas: string[];
  leadMinVehicleValuePence: number | null;
  leadMaxVehicleValuePence: number | null;
  leadMinVehicleYear: number | null;
  leadMaxVehicleMileage: number | null;
  leadMinAnnualIncomePence: number | null;
  leadFinanceTermMinMonths: number | null;
  leadFinanceTermMaxMonths: number | null;
  leadWarrantyLevels: string[];
  leadWarrantyMinMonths: number | null;
  leadWarrantyMaxMonths: number | null;
}

export interface MyCapabilities {
  profile: {
    id: string;
    businessName: string | null;
    phone: string | null;
    serviceArea: string | null;
  } | null;
  capabilities: ContractorCapability[];
  stripeConnect: { connected: boolean; complete: boolean };
}

export interface TradeTeamPermission {
  id: string;
  dealerProfileId: string;
  staffUserId: string | null;
  email: string;
  deliveryEnabled: boolean;
  inspectionEnabled: boolean;
  canView: boolean;
  canChat: boolean;
  canQuote: boolean;
  canManage: boolean;
  canComplete: boolean;
}

export interface PartnerTeam {
  dealerProfileId: string;
  companyName: string;
  stripeConnect: { connected: boolean; complete: boolean };
  capabilities: ContractorCapability[];
  permissions: TradeTeamPermission[];
  payoutPolicy: string;
}

export interface PartnerProfile {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dealerProfile?: {
    id?: string;
    companyName?: string | null;
    phone?: string | null;
    businessAddress?: string | null;
    isVerified?: boolean;
    kyc?: { status?: string | null } | null;
  } | null;
}

export interface LeadMatchingInput {
  leadNationwide: boolean;
  leadPostcodeAreas?: string[];
  leadMinVehicleValuePence?: number;
  leadMaxVehicleValuePence?: number;
  leadMinVehicleYear?: number;
  leadMaxVehicleMileage?: number;
  leadMinAnnualIncomePence?: number;
  leadFinanceTermMinMonths?: number;
  leadFinanceTermMaxMonths?: number;
  leadWarrantyLevels?: string[];
  leadWarrantyMinMonths?: number;
  leadWarrantyMaxMonths?: number;
}

export interface JobMatchingInput {
  jobNationwide: boolean;
  jobPostcodeAreas?: string[];
}

export async function getPartnerProfile(): Promise<PartnerProfile> {
  const r = await apiClient<{ success: boolean; data: PartnerProfile }>('/users/me');
  return r.data;
}

export async function elevateToPartner(): Promise<void> {
  await apiClient('/users/elevate', {
    method: 'POST',
    body: JSON.stringify({ newRole: 'DEALER' }),
  });
}

export async function savePartnerBusiness(input: {
  companyName: string;
  phone?: string;
  businessAddress?: string;
}): Promise<void> {
  await apiClient('/users/dealer-profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function getPartnerTeam(): Promise<PartnerTeam> {
  const r = await apiClient<{ data: PartnerTeam }>('/services/team');
  return r.data;
}

export async function getMyCapabilities(): Promise<MyCapabilities> {
  const r = await apiClient<{ data: MyCapabilities }>('/services/capabilities/my');
  return r.data;
}

export async function applyPartnerCapability(serviceType: ServiceType): Promise<ContractorCapability> {
  const r = await apiClient<{ data: ContractorCapability }>(`/services/team/capabilities/${serviceType}`, {
    method: 'POST',
  });
  return r.data;
}

export async function updateJobMatching(
  id: string,
  input: JobMatchingInput,
): Promise<ContractorCapability> {
  const r = await apiClient<{ data: ContractorCapability }>(
    `/services/capabilities/${id}/job-matching`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return r.data;
}

export async function updateLeadMatching(
  id: string,
  input: LeadMatchingInput,
): Promise<ContractorCapability> {
  const r = await apiClient<{ data: ContractorCapability }>(
    `/services/capabilities/${id}/lead-matching`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return r.data;
}

export async function createStripeConnectOnboarding(): Promise<string> {
  const r = await apiClient<{ data?: { url: string }; url?: string }>(
    '/users/stripe-connect/onboard',
    {
      method: 'POST',
      body: JSON.stringify({
        returnUrl: 'https://www.carmazium.com/dashboard/partner?stripe=done',
        refreshUrl: 'https://www.carmazium.com/dashboard/partner',
      }),
    },
  );
  const url = r.data?.url ?? r.url;
  if (!url) throw new Error('Stripe did not return an onboarding link');
  return url;
}
