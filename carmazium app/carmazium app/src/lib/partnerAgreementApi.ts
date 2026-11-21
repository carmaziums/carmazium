import { apiClient } from './apiClient';

export type BusinessKind = 'COMPANY' | 'SOLE_TRADER' | 'PARTNERSHIP' | 'OTHER_BUSINESS';

export interface PartnerAgreementDocument {
  title: string;
  version: string;
  sha256: string;
  text: string;
  requiresLegalReviewBeforeProduction: boolean;
}

export interface PartnerAgreementStatus {
  required: boolean;
  accepted: boolean;
  canSign: boolean;
  version: string;
  sha256: string;
  acceptance: null | {
    id: string; acceptedAt: string; legalEntityName: string;
    signatoryFullName: string; signatoryCapacity: string;
    agreementVersion: string; agreementSha256: string;
  };
}

export async function fetchPartnerAgreement(): Promise<PartnerAgreementDocument> {
  const result = await apiClient<{data: PartnerAgreementDocument}>('/legal/partner-agreement/document');
  return result.data;
}
export async function fetchPartnerAgreementStatus(): Promise<PartnerAgreementStatus> {
  const result = await apiClient<{data: PartnerAgreementStatus}>('/legal/partner-agreement/status');
  return result.data;
}
export async function signPartnerAgreement(input: {
  version: string;
  sha256: string;
  businessKind: BusinessKind;
  legalEntityName: string;
  registrationNumber?: string;
  signatoryFullName: string;
  signatoryCapacity: string;
  authorityConfirmed: true;
  explicitAcceptance: true;
  channel: 'ANDROID';
}) {
  const response = await apiClient<{data: {accepted: boolean; id: string; acceptedAt: string}}>('/legal/partner-agreement/accept', {
    method: 'POST', body: JSON.stringify(input),
  });
  return response.data;
}
