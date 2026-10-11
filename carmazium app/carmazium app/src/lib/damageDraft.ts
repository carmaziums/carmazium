/**
 * Version-neutral, account-scoped seller damage draft snapshot.
 * Never persist temporary picker file:// or content:// URIs in AsyncStorage:
 * they can disappear after app restarts and cannot be served to buyers.
 */
export type DraftDamageType = 'SCRATCH' | 'SCUFF' | 'DENT' | 'CRACK' | 'OTHER';
export interface DraftDamagePoint { fx: number; fy: number; fz: number }
export interface DraftDamageRecord {
  id: string;
  zone: string;
  type: DraftDamageType;
  description: string;
  surfacePoint?: DraftDamagePoint;
  damagePhotoUrl?: string;
}

const DAMAGE_CATEGORIES: readonly string[] = ['SCRATCH', 'SCUFF', 'DENT', 'CRACK', 'OTHER'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedPoint(value: unknown): DraftDamagePoint | undefined {
  if (!value || typeof value !== 'object') return;
  const item = value as Record<string, unknown>;
  if (!['fx', 'fy', 'fz'].every(key => typeof item[key] === 'number'
    && Number.isFinite(item[key]) && (item[key] as number) >= 0
    && (item[key] as number) <= 1)) return;
  return { fx: item.fx as number, fy: item.fy as number, fz: item.fz as number };
}

/** Supports restored legacy/malformed snapshots by safely dropping invalid rows. */
export function sanitizeDamageDraft(value: unknown): DraftDamageRecord[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const results: DraftDamageRecord[] = [];
  for (const raw of value.slice(0, 200)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !UUID_RE.test(item.id) || ids.has(item.id)) continue;
    if (typeof item.zone !== 'string' || !item.zone.trim()) continue;
    ids.add(item.id);
    const type = typeof item.type === 'string' && DAMAGE_CATEGORIES.includes(item.type)
      ? item.type as DraftDamageType : 'OTHER';
    const point = normalizedPoint(item.surfacePoint);
    const photo = typeof item.damagePhotoUrl === 'string'
      && item.damagePhotoUrl.startsWith('https://')
      && !item.damagePhotoUrl.includes('#cm-photo=')
      ? item.damagePhotoUrl : undefined;
    results.push({
      id: item.id,
      zone: item.zone.trim().slice(0, 160),
      type,
      description: typeof item.description === 'string' ? item.description.slice(0, 4000) : '',
      ...(point ? { surfacePoint: point } : {}),
      ...(photo ? { damagePhotoUrl: photo } : {}),
    });
  }
  return results;
}

/** True when removing one defect must NOT remove media shared by another. */
export function isDamagePhotoReferenced(
  photoUrl: string, records: readonly DraftDamageRecord[], images: readonly string[] = [],
): boolean {
  if (!photoUrl) return false;
  return records.some(item => item.damagePhotoUrl === photoUrl)
    || images.some(value => value.split('#cm-photo=')[0] === photoUrl);
}

/**
 * Drop image from the unsaved listing only if no other damage record needs it.
 * Never delete storage here; existing server-side listings may still reference it.
 */
export function withoutUnreferencedDamagePhoto(
  images: readonly string[], removedUrl: string, remaining: readonly DraftDamageRecord[],
): string[] {
  if (!removedUrl || remaining.some(item => item.damagePhotoUrl === removedUrl)) {
    return [...images];
  }
  return images.filter(value => value.split('#cm-photo=')[0] !== removedUrl);
}
