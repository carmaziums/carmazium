import { apiClient } from './apiClient';
import type {
  ContractorCapability,
  ServiceJob,
  ServiceLead,
} from './servicesApi';

export type ServiceCaseScope = 'CAPABILITY' | 'DISPUTE';
export type ServiceCaseEntryKind = 'DOCUMENT' | 'PHOTO' | 'NOTE' | 'RESOLUTION';

export interface ServiceCaseEntry {
  id: string;
  scope: ServiceCaseScope;
  entityId: string;
  submittedById: string | null;
  kind: ServiceCaseEntryKind;
  label: string | null;
  url: string | null;
  note: string | null;
  createdAt: string;
  submittedByFirstName?: string | null;
  submittedByLastName?: string | null;
  submittedByEmail?: string | null;
  submittedByRole?: string | null;
  evidenceType?: CapabilityEvidenceType | null;
  evidenceStatus?: CapabilityEvidenceStatus | null;
  evidenceIssuer?: string | null;
  evidenceReference?: string | null;
  evidenceValidFrom?: string | null;
  evidenceExpiresAt?: string | null;
  evidenceReviewedAt?: string | null;
  evidenceReviewedById?: string | null;
  evidenceReviewedByFirstName?: string | null;
  evidenceReviewedByLastName?: string | null;
  evidenceReviewNote?: string | null;
}

export type CapabilityEvidenceType =
  | 'BUSINESS_IDENTITY'
  | 'DELIVERY_BUSINESS_INSURANCE'
  | 'DELIVERY_GOODS_IN_TRANSIT'
  | 'INSPECTION_BUSINESS_INSURANCE'
  | 'INSPECTION_QUALIFICATION'
  | 'FINANCE_REGULATORY_AUTHORITY'
  | 'WARRANTY_REGULATORY_AUTHORITY'
  | 'WARRANTY_PRODUCT_AUTHORITY';

export type CapabilityEvidenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

export interface CapabilityVerificationRequirement {
  type: CapabilityEvidenceType;
  title: string;
  description: string;
  expiryRequired: boolean;
  state: 'SATISFIED' | 'PENDING' | 'REJECTED' | 'MISSING';
  currentEvidenceId: string | null;
  approvedEvidenceId: string | null;
  evidenceExpiresAt: string | null;
}

export interface CapabilityVerificationSummary {
  capabilityId: string;
  serviceType: 'DELIVERY' | 'INSPECTION' | 'FINANCE' | 'WARRANTY';
  capabilityStatus: string;
  verificationStatus: string;
  verificationCompletedAt: string | null;
  verificationExpiresAt: string | null;
  ready: boolean;
  recommendedExpiresAt: string | null;
  requirements: CapabilityVerificationRequirement[];
}

export interface CapabilityVerificationDetail {
  capabilityId: string;
  serviceType: CapabilityVerificationSummary['serviceType'];
  verification: CapabilityVerificationSummary;
  attachments: ServiceCaseEntry[];
}

export interface CapabilityEvidenceUploadInput {
  evidenceType: CapabilityEvidenceType;
  label?: string;
  issuer?: string;
  reference?: string;
  validFrom?: string;
  expiresAt?: string;
}

export interface AdminProviderDetailsUpdateInput {
  businessName: string;
  phone?: string;
  serviceArea?: string;
}

export interface ServiceCaseEntryInput {
  kind?: ServiceCaseEntryKind;
  label?: string;
  note?: string;
}

export interface CapabilityStatusHistoryEntry {
  id: string;
  capabilityId: string;
  fromStatus: string | null;
  toStatus: string;
  adminId: string | null;
  note: string | null;
  createdAt: string;
  adminFirstName?: string | null;
  adminLastName?: string | null;
  adminEmail?: string | null;
}

export interface AdminCapabilityDetail extends ContractorCapability {
  attachments: ServiceCaseEntry[];
  verification: CapabilityVerificationSummary;
  statusHistory: CapabilityStatusHistoryEntry[];
}

export interface ServiceSettlementOperation {
  id: string;
  jobId: string;
  paymentId: string;
  adminId: string;
  outcome: 'RELEASE' | 'REFUND';
  status: 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'REQUIRES_RECONCILIATION';
  note: string | null;
  externalReference: string | null;
  error: string | null;
  attemptCount: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  adminFirstName?: string | null;
  adminLastName?: string | null;
  adminEmail?: string | null;
}

export interface ServicePaymentAuditEvent {
  id: string;
  paymentId: string;
  jobId: string;
  fromStatus: string | null;
  toStatus: string;
  stripeTransferId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
}

export interface AdminJobDetail extends ServiceJob {
  caseEntries: ServiceCaseEntry[];
  settlementOperations: ServiceSettlementOperation[];
  paymentAuditEvents: ServicePaymentAuditEvent[];
}

export interface AdminLeadRecipient {
  id: string;
  leadId: string;
  contractorId: string;
  status: string;
  headline: string | null;
  message: string | null;
  productName: string | null;
  indicativePricePence: number | null;
  representativeApr: number | null;
  termMonths: number | null;
  matchedAt?: string | null;
  matchSource?: string | null;
  matchReason?: string | null;
  viewedAt: string | null;
  contactDisclosedAt?: string | null;
  respondedAt: string | null;
  createdAt: string;
  businessName: string | null;
  serviceArea: string | null;
  rating: number | null;
  totalReviews: number | null;
  providerFirstName: string | null;
  providerLastName: string | null;
  providerEmail: string | null;
  providerPhone: string | null;
}

export interface AdminServiceLeadDetail extends ServiceLead {
  consentToProviderContact?: boolean;
  consentRecordedAt?: string | null;
  recipients: AdminLeadRecipient[];
}

export async function getCapabilityAttachments(id: string): Promise<ServiceCaseEntry[]> {
  const r = await apiClient<{ data: ServiceCaseEntry[] }>(`/services/operations/capabilities/${id}/attachments`);
  return r.data;
}

export async function getCapabilityVerification(id: string): Promise<CapabilityVerificationDetail> {
  const r = await apiClient<{ data: CapabilityVerificationDetail }>(`/services/operations/capabilities/${id}/verification`);
  return r.data;
}

export async function uploadCapabilityAttachment(
  id: string,
  file: File,
  input: CapabilityEvidenceUploadInput,
): Promise<ServiceCaseEntry> {
  const body = new FormData();
  body.append('file', file);
  body.append('evidenceType', input.evidenceType);
  if (input.label?.trim()) body.append('label', input.label.trim());
  if (input.issuer?.trim()) body.append('issuer', input.issuer.trim());
  if (input.reference?.trim()) body.append('reference', input.reference.trim());
  if (input.validFrom) body.append('validFrom', input.validFrom);
  if (input.expiresAt) body.append('expiresAt', input.expiresAt);

  const r = await apiClient<{ data: ServiceCaseEntry }>(`/services/operations/capabilities/${id}/attachments`, {
    method: 'POST',
    body,
  });
  return r.data;
}

export async function deleteCapabilityAttachment(id: string, entryId: string): Promise<void> {
  await apiClient(`/services/operations/capabilities/${id}/attachments/${entryId}`, {
    method: 'DELETE',
  });
}

export async function adminGetCapabilityDetail(id: string): Promise<AdminCapabilityDetail> {
  const r = await apiClient<{ data: AdminCapabilityDetail }>(`/admin/services/operations/capabilities/${id}`);
  return r.data;
}

export async function adminUpdateProviderDetails(
  id: string,
  input: AdminProviderDetailsUpdateInput,
): Promise<AdminCapabilityDetail> {
  const r = await apiClient<{ data: AdminCapabilityDetail }>(
    `/admin/services/operations/capabilities/${id}/provider`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return r.data;
}

export async function adminUploadCapabilityEvidence(
  id: string,
  file: File,
  input: CapabilityEvidenceUploadInput,
): Promise<{ evidence: ServiceCaseEntry; verification: CapabilityVerificationSummary }> {
  const body = new FormData();
  body.append('file', file);
  body.append('evidenceType', input.evidenceType);
  if (input.label?.trim()) body.append('label', input.label.trim());
  if (input.issuer?.trim()) body.append('issuer', input.issuer.trim());
  if (input.reference?.trim()) body.append('reference', input.reference.trim());
  if (input.validFrom) body.append('validFrom', input.validFrom);
  if (input.expiresAt) body.append('expiresAt', input.expiresAt);
  const r = await apiClient<{ data: { evidence: ServiceCaseEntry; verification: CapabilityVerificationSummary } }>(
    `/admin/services/operations/capabilities/${id}/evidence/upload`,
    { method: 'POST', body },
  );
  return r.data;
}

export async function adminUpdateCapabilityEvidenceMetadata(
  capabilityId: string,
  entryId: string,
  input: CapabilityEvidenceUploadInput,
): Promise<{ evidence: ServiceCaseEntry | null; verification: CapabilityVerificationSummary }> {
  const r = await apiClient<{ data: { evidence: ServiceCaseEntry | null; verification: CapabilityVerificationSummary } }>(
    `/admin/services/operations/capabilities/${capabilityId}/evidence/${entryId}/metadata`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return r.data;
}

export async function adminReviewCapabilityEvidence(
  capabilityId: string,
  entryId: string,
  input: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string; expiresAt?: string },
): Promise<{ evidence: ServiceCaseEntry | null; verification: CapabilityVerificationSummary }> {
  const r = await apiClient<{ data: { evidence: ServiceCaseEntry | null; verification: CapabilityVerificationSummary } }>(
    `/admin/services/operations/capabilities/${capabilityId}/evidence/${entryId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return r.data;
}

export async function adminGetJobDetail(id: string): Promise<AdminJobDetail> {
  const r = await apiClient<{ data: AdminJobDetail }>(`/admin/services/operations/jobs/${id}`);
  return r.data;
}

export async function adminGetServiceLeadDetail(id: string): Promise<AdminServiceLeadDetail> {
  const r = await apiClient<{ data: AdminServiceLeadDetail }>(`/admin/services/operations/leads/${id}`);
  return r.data;
}

export async function adminAddDisputeCaseEntry(id: string, input: ServiceCaseEntryInput): Promise<ServiceCaseEntry> {
  const r = await apiClient<{ data: ServiceCaseEntry }>(`/admin/services/operations/jobs/${id}/case-entry`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function adminUploadDisputeCaseEntry(
  id: string,
  file: File,
  label?: string,
): Promise<ServiceCaseEntry> {
  const body = new FormData();
  body.append('file', file);
  if (label?.trim()) body.append('label', label.trim());

  const r = await apiClient<{ data: ServiceCaseEntry }>(`/admin/services/operations/jobs/${id}/case-entry/upload`, {
    method: 'POST',
    body,
  });
  return r.data;
}

export async function adminDeleteDisputeCaseEntry(id: string, entryId: string): Promise<void> {
  await apiClient(`/admin/services/operations/jobs/${id}/case-entry/${entryId}`, {
    method: 'DELETE',
  });
}

export async function adminResolveDisputeWithCase(
  id: string,
  input: { outcome: 'RELEASE' | 'REFUND'; note?: string },
): Promise<{
  success: boolean;
  settlementOperationId?: string;
  externalReference?: string | null;
  alreadyResolved?: boolean;
  recovered?: boolean;
}> {
  const r = await apiClient<{ data: {
    success: boolean;
    settlementOperationId?: string;
    externalReference?: string | null;
    alreadyResolved?: boolean;
    recovered?: boolean;
  } }>(`/admin/services/operations/jobs/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}
