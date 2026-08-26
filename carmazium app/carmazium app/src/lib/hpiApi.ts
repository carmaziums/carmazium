import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient } from './apiClient';
import { getAccessToken } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

/**
 * Mirrors web's src/lib/hpiApi.ts and backend/src/hpi/hpi-report.types.ts —
 * keep the three in step.
 */
export const HPI_CHECK_DEFINITIONS = [
  { key: 'stolen', label: 'Not recorded as stolen' },
  { key: 'scrapped', label: 'Not recorded as scrapped' },
  { key: 'writeOff', label: 'Not recorded as a write-off' },
  { key: 'imported', label: 'Not imported' },
  { key: 'exported', label: 'Not exported' },
  { key: 'thirdPartyInterest', label: 'No third-party interest' },
  { key: 'outstandingFinance', label: 'No outstanding finance' },
  { key: 'mileageDiscrepancy', label: 'No mileage discrepancies' },
  { key: 'colourChange', label: 'No colour changes' },
  { key: 'plateChange', label: 'No recorded plate changes' },
  { key: 'stockingFinance', label: 'No outstanding stocking finance' },
] as const;

export type HpiCheckKey = (typeof HPI_CHECK_DEFINITIONS)[number]['key'];

export interface HpiCheckEntry {
  passed: boolean;
  note?: string;
}

export interface HpiVehicleDetails {
  make?: string;
  model?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  engineCapacity?: string;
  vrm?: string;
  vin?: string;
  colour?: string;
  firstRegistered?: string;
  yearOfManufacture?: string;
  previousOwners?: string;
  co2Emissions?: string;
}

export interface HpiReportData {
  sourceName: string;
  sourceCheckDate: string;
  vehicle: HpiVehicleDetails;
  checks: Record<HpiCheckKey, HpiCheckEntry>;
  motStatus?: string;
  motExpiry?: string;
  motMileageRecording?: string;
  previousKeepers?: string;
  lastKeeperChange?: string;
}

/**
 * Three shapes reach this screen:
 *   ADMIN + report  — staff filled in the structured form
 *   ADMIN + hasPdf  — staff uploaded the supplied third-party PDF wholesale,
 *                     so there is no structured data, only the file
 *   LEGACY          — pre-existing OneAutoAPI rows
 *
 * A report can also be COMPLETED with neither yet — that's `status: 'PENDING'`,
 * which is now a normal state to find a live listing in: publishing no longer
 * waits for the report to be produced.
 */
export type HpiSummaryResponse =
  | {
      format: 'ADMIN';
      status: 'PENDING' | 'COMPLETED';
      vrm: string;
      isClear: boolean;
      purchasedAt: string;
      preparedAt: string | null;
      report: HpiReportData | null;
      hasPdf: boolean;
      pdfUploadedAt: string | null;
    }
  | {
      format: 'LEGACY';
      status: 'PENDING' | 'COMPLETED';
      vrm: string;
      make: string;
      model: string;
      colour: string;
      yearOfManufacture: string;
      registrationDate: string;
      engineSize: string;
      fuelType: string;
      isClear: boolean;
      purchasedAt: string;
      createdAt: string;
      checks: Record<string, { passed: boolean; detail: string; category?: string | null }>;
    };

/**
 * Returns null when no report has ever been requested for this listing — the
 * endpoint 404s in that case, which is an expected answer here rather than an
 * error worth surfacing.
 */
export async function getHpiSummary(listingId: string): Promise<HpiSummaryResponse | null> {
  try {
    const res = await apiClient<{ success: boolean; data: HpiSummaryResponse }>(
      `/hpi/listing/${listingId}/summary`,
    );
    return res?.data ?? null;
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    if (msg.includes('NO_SESSION') || msg.toLowerCase().includes('not found')) return null;
    throw err;
  }
}

/**
 * Downloads the report PDF and hands it to the OS share/preview sheet.
 *
 * The endpoint streams bytes behind auth, so it can't be a plain Linking.openURL
 * — FileSystem.downloadAsync is used specifically because it can carry the
 * Authorization header. Same approach as receipts in BuyerPurchaseHistoryScreen.
 */
export async function openHpiPdf(listingId: string, vrm?: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in again to open this report.');

  const safeVrm = (vrm || 'vehicle').replace(/[^A-Za-z0-9]/g, '');
  const fileUri = `${FileSystem.cacheDirectory}CarMazium_Vehicle_History_Report_${safeVrm}.pdf`;

  const result = await FileSystem.downloadAsync(
    `${API_URL}/hpi/listing/${listingId}/pdf`,
    fileUri,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (result.status !== 200) {
    throw new Error('Could not download the report PDF.');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } else {
    throw new Error('This device cannot open PDF files.');
  }
}

export function isReportReady(summary: HpiSummaryResponse | null): boolean {
  if (!summary || summary.status !== 'COMPLETED') return false;
  if (summary.format === 'LEGACY') return true;
  return !!summary.report || summary.hasPdf;
}
