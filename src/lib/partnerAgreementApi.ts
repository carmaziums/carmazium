import { apiClient } from '@/lib/apiClient';

export type BusinessKind = 'COMPANY' | 'SOLE_TRADER' | 'PARTNERSHIP' | 'OTHER_BUSINESS';

export interface PartnerAgreementDocument {
  title: string;
  version: string;
  sha256: string;
  text: string;
  requiresLegalReviewBeforeProduction: boolean;
}

export interface SignedPartnerAgreementReceipt {
  id: string;
  acceptedAt: string;
  legalEntityName: string;
  businessKind?: BusinessKind;
  signatoryFullName: string;
  signatoryCapacity: string;
  agreementVersion: string;
  agreementSha256: string;
}

export interface PartnerAgreementStatus {
  required: boolean;
  accepted: boolean;
  canSign: boolean;
  version: string;
  sha256: string;
  acceptance: SignedPartnerAgreementReceipt | null;
}

export interface PartnerAgreementSignature {
  version: string;
  sha256: string;
  businessKind: BusinessKind;
  legalEntityName: string;
  registrationNumber?: string;
  signatoryFullName: string;
  signatoryCapacity: string;
  authorityConfirmed: true;
  explicitAcceptance: true;
  channel: 'WEB' | 'ANDROID';
}

export async function fetchPartnerAgreement(): Promise<PartnerAgreementDocument> {
  const response = await apiClient<{data: PartnerAgreementDocument}>('/legal/partner-agreement/document');
  return response.data;
}

export async function fetchPartnerAgreementStatus(): Promise<PartnerAgreementStatus> {
  const response = await apiClient<{data: PartnerAgreementStatus}>('/legal/partner-agreement/status');
  return response.data;
}

export async function signPartnerAgreement(body: PartnerAgreementSignature) {
  const response = await apiClient<{data: {accepted: boolean; acceptedAt: string; id: string}}>(
    '/legal/partner-agreement/accept',
    {method: 'POST', body: JSON.stringify(body)},
  );
  return response.data;
}
