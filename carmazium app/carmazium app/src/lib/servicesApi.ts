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

export type ServiceJobStatus =
  | 'OPEN' | 'ACCEPTED' | 'PAID' | 'IN_PROGRESS' | 'COMPLETED' | 'RELEASED'
  | 'CANCELLED' | 'EXPIRED' | 'DISPUTED';

export type ServiceQuoteStatus =
  | 'ACTIVE' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';

export type ServiceLeadStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'EXPIRED';

export interface ServiceLeadResponse {
  id?: string;
  recipientId?: string;
  contractorId?: string;
  status?: string;
  headline: string | null;
  message: string | null;
  productName: string | null;
  indicativePricePence: number | null;
  representativeApr: number | null;
  termMonths: number | null;
  businessName?: string | null;
  rating?: number | null;
  totalReviews?: number | null;
  serviceArea?: string | null;
  respondedAt?: string | null;
  matchedAt?: string | null;
  matchSource?: 'AUTO' | 'ADMIN_REMATCH' | string;
  matchReason?: string | null;
  contactDisclosedAt?: string | null;
}

export interface ServiceLead {
  id: string;
  customerId: string;
  serviceType: 'FINANCE' | 'WARRANTY';
  status: ServiceLeadStatus;
  listingId: string | null;
  vehicleRegistration: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleMileage: number | null;
  vehicleValuePence: number | null;
  fullName?: string | null;
  email?: string | null;
  phone: string | null;
  postcode: string | null;
  summary: string | null;
  depositPence: number | null;
  termMonths: number | null;
  monthlyBudgetPence: number | null;
  employmentStatus: string | null;
  annualIncomePence: number | null;
  warrantyMonths: number | null;
  warrantyLevel: string | null;
  expiresAt: string;
  createdAt: string;
  recipientCount?: number;
  responseCount?: number;
  recipientId?: string;
  recipientStatus?: string;
  headline?: string | null;
  message?: string | null;
  productName?: string | null;
  indicativePricePence?: number | null;
  representativeApr?: number | null;
  responseTermMonths?: number | null;
  responses?: ServiceLeadResponse[];
}

export interface ServiceMarketplaceSettings {
  platformFeeRate: number;
  providerShareRate: number;
  acceptedPaymentTimeoutMinutes: number;
}

export interface JobVehicle {
  id?: string;
  registration?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  notes?: string | null;
  listingId?: string | null;
}

export interface ContractorSummary {
  id: string;
  businessName: string | null;
  phone?: string | null;
  rating: number;
  totalReviews: number;
  serviceArea: string | null;
  user: {
    firstName: string | null;
    lastName?: string | null;
    email?: string;
    phone?: string | null;
  };
}

export interface ServiceQuote {
  id: string;
  jobId: string;
  contractorId: string;
  amountPence: number;
  message: string | null;
  status: ServiceQuoteStatus;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  contractor?: ContractorSummary;
}

export interface ServiceReview {
  id: string;
  jobId: string;
  customerId: string;
  contractorId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePayment {
  id: string;
  grossPence: number;
  platformFeePence: number;
  contractorPence: number;
  platformFeeRate: string;
  status: 'PENDING' | 'PAID' | 'RELEASED' | 'REFUNDED' | 'FAILED';
  paidAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
}

export interface ServiceJob {
  id: string;
  customerId?: string | null;
  serviceType: ServiceType;
  isRecovery: boolean;
  status: ServiceJobStatus;
  title: string;
  description: string | null;
  pickupPostcode: string | null;
  pickupAddress: string | null;
  deliveryPostcode: string | null;
  deliveryAddress: string | null;
  servicePostcode: string | null;
  serviceAddress: string | null;
  requestedFor: string | null;
  expiresAt: string;
  acceptedQuoteId: string | null;
  contractorId: string | null;
  agreedAmountPence: number | null;
  platformFeeRate: string | null;
  platformFeePence: number | null;
  contractorAmountPence: number | null;
  sourceOfferId: string | null;
  sourceAuctionId: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  inspectionOutcome?: 'PASS' | 'FAULTS_FOUND' | null;
  inspectionSummary?: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  vehicles: JobVehicle[];
  customer?: {
    id: string;
    firstName: string | null;
    lastName?: string | null;
    email?: string;
    phone?: string | null;
  } | null;
  contractor?: ContractorSummary | null;
  quotes?: ServiceQuote[];
  payment?: ServicePayment | null;
  review?: ServiceReview | null;
  canReview?: boolean;
  eligibleProviderCount?: number | null;
  _count?: { quotes: number; vehicles?: number };
  viewerRole?: 'customer' | 'contractor' | 'admin' | 'bidder';
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const formatPence = (p: number) =>
  `£${(p / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
export async function getServiceSettings(): Promise<ServiceMarketplaceSettings> {
  const r = await apiClient<{ data: ServiceMarketplaceSettings }>('/services/settings');
  return r.data;
}


export interface CreateServiceLeadInput {
  serviceType: 'FINANCE' | 'WARRANTY';
  listingId?: string;
  vehicleRegistration?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleMileage?: number;
  vehicleValuePence?: number;
  phone?: string;
  postcode?: string;
  summary?: string;
  depositPence?: number;
  termMonths?: number;
  monthlyBudgetPence?: number;
  employmentStatus?: string;
  annualIncomePence?: number;
  warrantyMonths?: number;
  warrantyLevel?: string;
  consentToProviderContact: boolean;
}

export async function createServiceLead(input: CreateServiceLeadInput): Promise<ServiceLead> {
  const r = await apiClient<{ data: ServiceLead }>('/services/leads', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function getMyServiceLeadsPage(
  cursor?: string,
  limit = 20,
): Promise<CursorPage<ServiceLead>> {
  const query = [
    `limit=${encodeURIComponent(String(limit))}`,
    cursor ? `cursor=${encodeURIComponent(cursor)}` : null,
  ].filter(Boolean).join('&');
  const r = await apiClient<{ data: CursorPage<ServiceLead> }>(`/services/leads/my?${query}`);
  return r.data;
}

export async function getServiceLead(id: string): Promise<ServiceLead> {
  const r = await apiClient<{ data: ServiceLead }>(`/services/leads/${id}`);
  return r.data;
}

export async function closeServiceLead(id: string): Promise<ServiceLead> {
  const r = await apiClient<{ data: ServiceLead }>(`/services/leads/${id}/close`, {
    method: 'POST',
  });
  return r.data;
}


export async function createInspectionFromAuction(input: {
  auctionId: string;
  servicePostcode?: string;
  serviceAddress?: string;
  requestedFor?: string;
}): Promise<ServiceJob> {
  const r = await apiClient<{ data: ServiceJob }>('/services/jobs/inspection/from-auction', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function getMyServiceJobsPage(
  cursor?: string,
  limit = 20,
): Promise<CursorPage<ServiceJob>> {
  const query = [
    `limit=${encodeURIComponent(String(limit))}`,
    cursor ? `cursor=${encodeURIComponent(cursor)}` : null,
  ].filter(Boolean).join('&');
  const r = await apiClient<{ data: CursorPage<ServiceJob> }>(`/services/jobs/my?${query}`);
  return r.data;
}

export async function getCustomerServiceJob(id: string): Promise<ServiceJob> {
  const r = await apiClient<{ data: ServiceJob }>(`/services/jobs/${id}`);
  return r.data;
}

export async function acceptCustomerQuote(jobId: string, quoteId: string): Promise<string> {
  const r = await apiClient<{ data: { checkoutUrl: string } }>(
    `/services/jobs/${jobId}/quotes/${quoteId}/accept`,
    { method: 'POST' },
  );
  return r.data.checkoutUrl;
}

export async function cancelCustomerServiceJob(id: string, reason?: string): Promise<void> {
  await apiClient(`/services/jobs/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function confirmCustomerServiceJob(id: string): Promise<void> {
  await apiClient(`/services/jobs/${id}/confirm`, { method: 'POST' });
}

export async function disputeCustomerServiceJob(id: string, reason?: string): Promise<void> {
  await apiClient(`/services/jobs/${id}/dispute`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function createCustomerServiceReview(
  id: string,
  input: { rating: number; comment?: string },
): Promise<ServiceReview> {
  const r = await apiClient<{ data: ServiceReview }>(`/services/jobs/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function getJobFeedPage(
  serviceType?: ServiceType,
  cursor?: string,
  limit = 20,
): Promise<CursorPage<ServiceJob>> {
  const query = [
    `limit=${encodeURIComponent(String(limit))}`,
    serviceType ? `serviceType=${encodeURIComponent(serviceType)}` : null,
    cursor ? `cursor=${encodeURIComponent(cursor)}` : null,
  ].filter(Boolean).join('&');
  const r = await apiClient<{ data: CursorPage<ServiceJob> }>(`/services/jobs/feed?${query}`);
  return r.data;
}

export async function getAssignedJobsPage(
  cursor?: string,
  limit = 20,
): Promise<CursorPage<ServiceJob>> {
  const query = [
    `limit=${encodeURIComponent(String(limit))}`,
    cursor ? `cursor=${encodeURIComponent(cursor)}` : null,
  ].filter(Boolean).join('&');
  const r = await apiClient<{ data: CursorPage<ServiceJob> }>(`/services/jobs/assigned?${query}`);
  return r.data;
}

export async function getProviderJob(id: string): Promise<ServiceJob> {
  const r = await apiClient<{ data: ServiceJob }>(`/services/jobs/${id}`);
  return r.data;
}

export async function upsertProviderQuote(
  jobId: string,
  input: { amountPence: number; message?: string; validUntil?: string },
): Promise<ServiceQuote> {
  const r = await apiClient<{ data: ServiceQuote }>(`/services/jobs/${jobId}/quote`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function withdrawProviderQuote(jobId: string): Promise<void> {
  await apiClient(`/services/jobs/${jobId}/quote`, { method: 'DELETE' });
}

export async function startProviderJob(id: string): Promise<void> {
  await apiClient(`/services/jobs/${id}/start`, { method: 'POST' });
}

export async function completeProviderJob(
  id: string,
  input?: { inspectionOutcome?: 'PASS' | 'FAULTS_FOUND'; inspectionSummary?: string },
): Promise<void> {
  await apiClient(`/services/jobs/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}
export async function getProviderLeadInboxPage(
  serviceType?: 'FINANCE' | 'WARRANTY',
  cursor?: string,
  limit = 20,
): Promise<CursorPage<ServiceLead>> {
  const query = [
    `limit=${encodeURIComponent(String(limit))}`,
    serviceType ? `serviceType=${encodeURIComponent(serviceType)}` : null,
    cursor ? `cursor=${encodeURIComponent(cursor)}` : null,
  ].filter(Boolean).join('&');
  const r = await apiClient<{ data: CursorPage<ServiceLead> }>(`/services/leads/inbox?${query}`);
  return r.data;
}

export async function getProviderServiceLead(id: string): Promise<ServiceLead> {
  const r = await apiClient<{ data: ServiceLead }>(`/services/leads/inbox/${id}`);
  return r.data;
}

type LeadResponseCommon = {
  headline: string;
  message: string;
  productName?: string;
  indicativePricePence?: number;
};

export type FinanceLeadResponseInput = LeadResponseCommon & {
  representativeApr?: number;
  termMonths?: number;
};

export type WarrantyLeadResponseInput = LeadResponseCommon & {
  representativeApr?: never;
  termMonths?: never;
};

export async function respondToProviderLead(
  id: string,
  input: FinanceLeadResponseInput | WarrantyLeadResponseInput,
): Promise<ServiceLeadResponse> {
  const r = await apiClient<{ data: ServiceLeadResponse }>(`/services/leads/${id}/respond`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return r.data;
}

