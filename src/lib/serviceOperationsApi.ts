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
}

export interface ServiceCaseEntryInput {
  kind?: ServiceCaseEntryKind;
  label?: string;
  note?: string;
}

export interface AdminCapabilityDetail extends ContractorCapability {
  attachments: ServiceCaseEntry[];
}

export interface AdminJobDetail extends ServiceJob {
  caseEntries: ServiceCaseEntry[];
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
  viewedAt: string | null;
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

export async function uploadCapabilityAttachment(
  id: string,
  file: File,
  label?: string,
): Promise<ServiceCaseEntry> {
  const body = new FormData();
  body.append('file', file);
  if (label?.trim()) body.append('label', label.trim());

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
): Promise<void> {
  await apiClient(`/admin/services/operations/jobs/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
