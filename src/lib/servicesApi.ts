import { apiClient } from './apiClient';

export type ServiceType = 'DELIVERY' | 'INSPECTION' | 'FINANCE' | 'WARRANTY';
export type CapabilityStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type ServiceJobStatus =
  | 'OPEN' | 'ACCEPTED' | 'PAID' | 'IN_PROGRESS' | 'COMPLETED' | 'RELEASED'
  | 'CANCELLED' | 'EXPIRED' | 'DISPUTED';
export type ServiceQuoteStatus = 'ACTIVE' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';
export type ServicePaymentStatus = 'PENDING' | 'PAID' | 'RELEASED' | 'REFUNDED' | 'FAILED';
export type ServiceLeadStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'EXPIRED';

export const SERVICE_LABELS: Record<ServiceType, string> = {
  DELIVERY: 'Delivery & Recovery',
  INSPECTION: 'Vehicle Inspections',
  FINANCE: 'Vehicle Finance',
  WARRANTY: 'Warranty Providers',
};

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
  listing?: { id: string; slug: string; title: string } | null;
}

export interface ContractorSummary {
  id: string;
  businessName: string | null;
  phone?: string | null;
  rating: number;
  totalReviews: number;
  serviceArea: string | null;
  user: { firstName: string | null; lastName?: string | null; email?: string; phone?: string | null };
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
  status: ServicePaymentStatus;
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
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  vehicles: JobVehicle[];
  customer?: { id: string; firstName: string | null; lastName?: string | null; email?: string; phone?: string | null } | null;
  contractor?: ContractorSummary | null;
  quotes?: ServiceQuote[];
  payment?: ServicePayment | null;
  review?: ServiceReview | null;
  canReview?: boolean;
  _count?: { quotes: number; vehicles?: number };
  /** Current verified paid-job providers matching this service/area. */
  eligibleProviderCount?: number | null;
  viewerRole?: 'customer' | 'contractor' | 'admin' | 'bidder';
}

export interface ContractorCapability {
  id: string;
  contractorId: string;
  serviceType: ServiceType;
  status: CapabilityStatus;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  verificationStatus: 'NOT_SUBMITTED' | 'IN_REVIEW' | 'READY' | 'VERIFIED' | 'REVERIFICATION_REQUIRED' | 'REJECTED' | string;
  verificationCompletedAt: string | null;
  verificationExpiresAt: string | null;
  verificationReminder30SentAt: string | null;
  verificationReminder7SentAt: string | null;
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
  contractor?: ContractorSummary & {
    user: { id: string; firstName: string | null; lastName: string | null; email: string; stripeConnectAccountId: string | null; stripeConnectOnboardingComplete: boolean };
  };
  reviewedBy?: { firstName: string | null; lastName: string | null } | null;
}

export interface MyCapabilities {
  profile: { id: string; businessName: string | null; phone: string | null; serviceArea: string | null } | null;
  capabilities: ContractorCapability[];
  stripeConnect: { connected: boolean; complete: boolean };
}

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

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const formatPence = (p: number) =>
  `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function getServiceSettings(): Promise<ServiceMarketplaceSettings> {
  const r = await apiClient<{ data: ServiceMarketplaceSettings }>('/services/settings');
  return r.data;
}

// Paid jobs: Delivery + Inspection
export interface CreateJobInput {
  serviceType: ServiceType;
  isRecovery?: boolean;
  title: string;
  description?: string;
  pickupPostcode?: string;
  pickupAddress?: string;
  deliveryPostcode?: string;
  deliveryAddress?: string;
  servicePostcode?: string;
  serviceAddress?: string;
  requestedFor?: string;
  vehicles: JobVehicle[];
}

export async function createJob(input: CreateJobInput): Promise<ServiceJob> {
  const r = await apiClient<{ data: ServiceJob }>('/services/jobs', { method: 'POST', body: JSON.stringify(input) });
  return r.data;
}
export type PurchaseDeliverySource =
  | { offerId: string; auctionId?: never }
  | { auctionId: string; offerId?: never };

export async function createJobFromPurchase(input: PurchaseDeliverySource & {
  deliveryPostcode: string;
  deliveryAddress?: string;
  requestedFor?: string;
}): Promise<ServiceJob> {
  const r = await apiClient<{ data: ServiceJob }>('/services/jobs/from-purchase', { method: 'POST', body: JSON.stringify(input) });
  return r.data;
}
export async function getMyJobsPage(cursor?: string, limit = 20): Promise<CursorPage<ServiceJob>> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set('cursor', cursor);
  const r = await apiClient<{ data: CursorPage<ServiceJob> }>(`/services/jobs/my?${q.toString()}`);
  return r.data;
}
export async function getMyJobs(): Promise<ServiceJob[]> {
  return (await getMyJobsPage()).items;
}
export async function getJob(id: string): Promise<ServiceJob> {
  const r = await apiClient<{ data: ServiceJob }>(`/services/jobs/${id}`); return r.data;
}
export async function cancelJob(id: string, reason?: string): Promise<void> {
  await apiClient(`/services/jobs/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export async function acceptQuote(jobId: string, quoteId: string): Promise<string> {
  const r = await apiClient<{ data: { checkoutUrl: string } }>(`/services/jobs/${jobId}/quotes/${quoteId}/accept`, { method: 'POST' });
  return r.data.checkoutUrl;
}
export async function confirmCompletion(id: string): Promise<void> { await apiClient(`/services/jobs/${id}/confirm`, { method: 'POST' }); }
export async function disputeJob(id: string, reason?: string): Promise<void> {
  await apiClient(`/services/jobs/${id}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export async function createServiceReview(
  id: string,
  input: { rating: number; comment?: string },
): Promise<ServiceReview> {
  const r = await apiClient<{ data: ServiceReview }>(`/services/jobs/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}

// Provider capabilities + paid-job work
export async function applyCapability(input: { serviceType: ServiceType; businessName?: string; phone?: string; serviceArea?: string }): Promise<ContractorCapability> {
  const r = await apiClient<{ data: ContractorCapability }>('/services/capabilities', { method: 'POST', body: JSON.stringify(input) }); return r.data;
}
export async function getMyCapabilities(): Promise<MyCapabilities> {
  const r = await apiClient<{ data: MyCapabilities }>('/services/capabilities/my'); return r.data;
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
export async function updateJobMatching(id: string, input: JobMatchingInput): Promise<ContractorCapability> {
  const r = await apiClient<{ data: ContractorCapability }>(`/services/capabilities/${id}/job-matching`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function updateLeadMatching(id: string, input: LeadMatchingInput): Promise<ContractorCapability> {
  const r = await apiClient<{ data: ContractorCapability }>(`/services/capabilities/${id}/lead-matching`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return r.data;
}
export async function getJobFeedPage(
  serviceType?: ServiceType,
  cursor?: string,
  limit = 20,
): Promise<CursorPage<ServiceJob>> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (serviceType) q.set('serviceType', serviceType);
  if (cursor) q.set('cursor', cursor);
  const r = await apiClient<{ data: CursorPage<ServiceJob> }>(`/services/jobs/feed?${q.toString()}`);
  return r.data;
}
export async function getJobFeed(serviceType?: ServiceType): Promise<ServiceJob[]> {
  return (await getJobFeedPage(serviceType)).items;
}
export async function getAssignedJobsPage(cursor?: string, limit = 20): Promise<CursorPage<ServiceJob>> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set('cursor', cursor);
  const r = await apiClient<{ data: CursorPage<ServiceJob> }>(`/services/jobs/assigned?${q.toString()}`);
  return r.data;
}
export async function getAssignedJobs(): Promise<ServiceJob[]> {
  return (await getAssignedJobsPage()).items;
}
export async function upsertQuote(jobId: string, input: { amountPence: number; message?: string; validUntil?: string }): Promise<ServiceQuote> {
  const r = await apiClient<{ data: ServiceQuote }>(`/services/jobs/${jobId}/quote`, { method: 'PUT', body: JSON.stringify(input) }); return r.data;
}
export async function withdrawQuote(jobId: string): Promise<void> { await apiClient(`/services/jobs/${jobId}/quote`, { method: 'DELETE' }); }
export async function startJob(id: string): Promise<void> { await apiClient(`/services/jobs/${id}/start`, { method: 'POST' }); }
export async function completeJob(id: string): Promise<void> { await apiClient(`/services/jobs/${id}/complete`, { method: 'POST' }); }

// Enquiries: Finance + Warranty. No CarMazium payment is created.
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
  const r = await apiClient<{ data: ServiceLead }>('/services/leads', { method: 'POST', body: JSON.stringify(input) }); return r.data;
}
export async function getMyServiceLeadsPage(cursor?: string, limit = 20): Promise<CursorPage<ServiceLead>> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set('cursor', cursor);
  const r = await apiClient<{ data: CursorPage<ServiceLead> }>(`/services/leads/my?${q.toString()}`);
  return r.data;
}
export async function getMyServiceLeads(): Promise<ServiceLead[]> {
  return (await getMyServiceLeadsPage()).items;
}
export async function getServiceLead(id: string): Promise<ServiceLead> {
  const r = await apiClient<{ data: ServiceLead }>(`/services/leads/${id}`); return r.data;
}
export async function closeServiceLead(id: string): Promise<ServiceLead> {
  const r = await apiClient<{ data: ServiceLead }>(`/services/leads/${id}/close`, { method: 'POST' }); return r.data;
}
export async function getLeadInboxPage(
  serviceType?: 'FINANCE' | 'WARRANTY',
  cursor?: string,
  limit = 20,
): Promise<CursorPage<ServiceLead>> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (serviceType) q.set('serviceType', serviceType);
  if (cursor) q.set('cursor', cursor);
  const r = await apiClient<{ data: CursorPage<ServiceLead> }>(`/services/leads/inbox?${q.toString()}`);
  return r.data;
}
export async function getLeadInbox(serviceType?: 'FINANCE' | 'WARRANTY'): Promise<ServiceLead[]> {
  return (await getLeadInboxPage(serviceType)).items;
}
export async function getProviderServiceLead(id: string): Promise<ServiceLead> {
  const r = await apiClient<{ data: ServiceLead }>(`/services/leads/inbox/${id}`); return r.data;
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
export async function respondToServiceLead(
  id: string,
  input: FinanceLeadResponseInput | WarrantyLeadResponseInput,
): Promise<ServiceLeadResponse> {
  const r = await apiClient<{ data: ServiceLeadResponse }>(`/services/leads/${id}/respond`, { method: 'PUT', body: JSON.stringify(input) }); return r.data;
}

// Admin
export interface AdminCapabilityFilters {
  status?: CapabilityStatus;
  serviceType?: ServiceType;
  q?: string;
}
export async function adminGetCapabilities(
  input?: CapabilityStatus | AdminCapabilityFilters,
): Promise<ContractorCapability[]> {
  const filters = typeof input === 'string' ? { status: input } : (input ?? {});
  const q = new URLSearchParams();
  if (filters.status) q.set('status', filters.status);
  if (filters.serviceType) q.set('serviceType', filters.serviceType);
  if (filters.q?.trim()) q.set('q', filters.q.trim());
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const r = await apiClient<{ data: ContractorCapability[] }>(`/admin/services/capabilities${suffix}`);
  return r.data;
}
export async function adminReviewCapability(id: string, input: { status: CapabilityStatus; reviewNote?: string }): Promise<ContractorCapability> {
  const r = await apiClient<{ data: ContractorCapability }>(`/admin/services/capabilities/${id}`, { method: 'PATCH', body: JSON.stringify(input) }); return r.data;
}
export interface AdminJobFilters {
  status?: ServiceJobStatus;
  serviceType?: Extract<ServiceType, 'DELIVERY' | 'INSPECTION'>;
  q?: string;
}
export async function adminGetJobs(
  input?: ServiceJobStatus | AdminJobFilters,
): Promise<ServiceJob[]> {
  const filters = typeof input === 'string' ? { status: input } : (input ?? {});
  const q = new URLSearchParams();
  if (filters.status) q.set('status', filters.status);
  if (filters.serviceType) q.set('serviceType', filters.serviceType);
  if (filters.q?.trim()) q.set('q', filters.q.trim());
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const r = await apiClient<{ data: ServiceJob[] }>(`/admin/services/jobs${suffix}`);
  return r.data;
}
export async function adminGetDisputes(
  input?: Omit<AdminJobFilters, 'status'>,
): Promise<ServiceJob[]> {
  const q = new URLSearchParams();
  if (input?.serviceType) q.set('serviceType', input.serviceType);
  if (input?.q?.trim()) q.set('q', input.q.trim());
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const r = await apiClient<{ data: ServiceJob[] }>(`/admin/services/disputes${suffix}`);
  return r.data;
}
/** Compatibility wrapper: all admin dispute settlement goes through the authoritative operations route. */
export async function adminResolveDispute(id: string, input: { outcome: 'RELEASE' | 'REFUND'; note?: string }): Promise<void> {
  await apiClient(`/admin/services/operations/jobs/${id}/resolve`, { method: 'POST', body: JSON.stringify(input) });
}
export async function adminRematchServiceLead(id: string): Promise<{ added: number; recipientCount: number; recipientLimit: number }> {
  const r = await apiClient<{ data: { added: number; recipientCount: number; recipientLimit: number } }>(`/admin/services/leads/${id}/rematch`, { method: 'POST' });
  return r.data;
}
export async function adminGetServiceLeads(
  serviceType?: 'FINANCE' | 'WARRANTY',
  status?: ServiceLeadStatus,
  query?: string,
): Promise<ServiceLead[]> {
  const q = new URLSearchParams();
  if (serviceType) q.set('serviceType', serviceType);
  if (status) q.set('status', status);
  if (query?.trim()) q.set('q', query.trim());
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const r = await apiClient<{ data: ServiceLead[] }>(`/admin/services/leads${suffix}`); return r.data;
}
