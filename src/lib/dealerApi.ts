import { apiClient } from './apiClient';

export interface DealerKycData {
  id?: string;
  dealerProfileId?: string;
  companyHouseName: string;
  representativeName: string;
  representativePosition: string;
  vatNumber: string;
  companyRegistrationNumber: string;
  personOfSignificantControl: string;
  directorName: string;
  businessWebsite: string;
  businessRegisteredAddress: string;
  tradingAddress?: string;
  googleReviewsLink?: string;
  paymentReference: string;
  paymentScreenshot?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  documentStatuses?: Record<
    string,
    {
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
      note: string;
    }
  >;
  submittedAt?: string;
  reviewedAt?: string;
}

export async function getDealerKyc(): Promise<DealerKycData | null> {
  const result = await apiClient<{ data: DealerKycData | null }>('/dealers/kyc');
  return result.data;
}

export async function submitDealerKyc(data: Partial<DealerKycData>): Promise<DealerKycData> {
  const result = await apiClient<{ data: DealerKycData }>('/dealers/kyc', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}
