import { apiClient } from './apiClient';

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

export interface ServiceCaseEntry {
  id: string;
  label: string | null;
  url: string | null;
  createdAt: string;
  evidenceType?: CapabilityEvidenceType | null;
  evidenceStatus?: CapabilityEvidenceStatus | null;
  evidenceIssuer?: string | null;
  evidenceReference?: string | null;
  evidenceValidFrom?: string | null;
  evidenceExpiresAt?: string | null;
  evidenceReviewNote?: string | null;
}

export interface CapabilityVerificationDetail {
  capabilityId: string;
  serviceType: 'DELIVERY' | 'INSPECTION' | 'FINANCE' | 'WARRANTY';
  verification: {
    capabilityId: string;
    serviceType: 'DELIVERY' | 'INSPECTION' | 'FINANCE' | 'WARRANTY';
    capabilityStatus: string;
    verificationStatus: string;
    verificationCompletedAt: string | null;
    verificationExpiresAt: string | null;
    ready: boolean;
    recommendedExpiresAt: string | null;
    requirements: CapabilityVerificationRequirement[];
  };
  attachments: ServiceCaseEntry[];
}

export interface MobileEvidenceFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface CapabilityEvidenceUploadInput {
  evidenceType: CapabilityEvidenceType;
  label?: string;
  issuer?: string;
  reference?: string;
  validFrom?: string;
  expiresAt?: string;
}

export async function getCapabilityVerification(
  id: string,
): Promise<CapabilityVerificationDetail> {
  const r = await apiClient<{ data: CapabilityVerificationDetail }>(
    `/services/operations/capabilities/${id}/verification`,
  );
  return r.data;
}

export async function uploadCapabilityAttachment(
  id: string,
  file: MobileEvidenceFile,
  input: CapabilityEvidenceUploadInput,
): Promise<ServiceCaseEntry> {
  const body = new FormData();
  body.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as any);
  body.append('evidenceType', input.evidenceType);
  if (input.label?.trim()) body.append('label', input.label.trim());
  if (input.issuer?.trim()) body.append('issuer', input.issuer.trim());
  if (input.reference?.trim()) body.append('reference', input.reference.trim());
  if (input.validFrom) body.append('validFrom', input.validFrom);
  if (input.expiresAt) body.append('expiresAt', input.expiresAt);

  const r = await apiClient<{ data: ServiceCaseEntry }>(
    `/services/operations/capabilities/${id}/attachments`,
    { method: 'POST', body, timeoutMs: 30_000 },
  );
  return r.data;
}

export async function deleteCapabilityAttachment(
  id: string,
  entryId: string,
): Promise<void> {
  await apiClient(
    `/services/operations/capabilities/${id}/attachments/${entryId}`,
    { method: 'DELETE' },
  );
}
