/**
 * Search conditions for door/seat maximums, the saved DVLA MOT/tax snapshot
 * and seller-declared history. Values verified against stored listings:
 * motStatus "Valid" | "Not valid" | "No details held by DVLA";
 * taxStatus "Taxed" | "Untaxed" | "SORN"; serviceHistory uses the listing
 * form's four options plus a few legacy spellings; owners "1".."4" | "5+".
 */
export interface HistoryFilterInput {
  maxDoors?: number;
  maxSeats?: number;
  motValid?: boolean;
  taxedOnly?: boolean;
  serviceHistories?: string[];
  maxOwners?: number;
}

export const SERVICE_HISTORY_VALUES: Record<string, string[]> = {
  FULL_MAIN_DEALER: ['Full Main Dealer'],
  FULL_INDEPENDENT: ['Full Independent', 'FULL', 'Full'],
  PARTIAL: ['Partial', 'Part', 'PARTIAL'],
  NONE: ['None', 'NONE'],
};

export function applyHistoryFilters(where: Record<string, any>, f: HistoryFilterInput): void {
  if (f.maxDoors !== undefined) where.doors = { ...(where.doors ?? {}), lte: f.maxDoors };
  if (f.maxSeats !== undefined) where.seats = { ...(where.seats ?? {}), lte: f.maxSeats };
  if (f.motValid === true) where.motStatus = { equals: 'Valid', mode: 'insensitive' };
  if (f.taxedOnly === true) where.taxStatus = { equals: 'Taxed', mode: 'insensitive' };
  if (f.serviceHistories?.length) {
    where.serviceHistory = { in: f.serviceHistories.flatMap((k) => SERVICE_HISTORY_VALUES[k] ?? []) };
  }
  if (f.maxOwners !== undefined) {
    const allowed = ['1', '2', '3', '4'].filter((n) => Number(n) <= f.maxOwners!);
    if (f.maxOwners >= 5) allowed.push('5', '5+');
    where.owners = { in: allowed };
  }
}
