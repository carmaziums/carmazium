import { apiClient } from './apiClient';

export interface StartAddressVerificationResult {
  address: string;
  expiresAt: string;
  message: string;
}

export interface ConfirmAddressVerificationResult {
  verified: boolean;
  address: string;
  verifiedAt: string;
}

export async function startAddressVerification(address: string): Promise<StartAddressVerificationResult> {
  const res = await apiClient<{ success: boolean; data: StartAddressVerificationResult }>(
    '/users/me/address-verification/start',
    {
      method: 'POST',
      body: JSON.stringify({ address }),
    },
  );
  return res.data;
}

export async function confirmAddressVerification(code: string): Promise<ConfirmAddressVerificationResult> {
  const res = await apiClient<{ success: boolean; data: ConfirmAddressVerificationResult }>(
    '/users/me/address-verification/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    },
  );
  return res.data;
}
