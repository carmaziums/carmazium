import AsyncStorage from '@react-native-async-storage/async-storage';
import { deletePublicStorageObject } from './storageHelper';

/**
 * Cleanup is deferred to avoid deleting an image still referenced by a
 * pending listing PATCH or a seller's persisted draft. Owner-scoped records
 * survive app restarts and are retried on the next seller-draft visit.
 */
const GRACE_MS = 24 * 60 * 60 * 1000;
interface OrphanPhoto { url: string; queuedAt: number }
const storageKey = (ownerId: string): string | null => (
  /^[a-zA-Z0-9_-]{1,128}$/.test(ownerId) ? `czm-damage-orphans-v1:${ownerId}` : null
);
function ownDamagePhoto(url: string, ownerId: string): boolean {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/listings/${ownerId}/damage/`;
    return parsed.protocol === 'https:' && parsed.pathname.startsWith(marker)
      && parsed.pathname.endsWith('.jpg');
  } catch { return false; }
}
function validEntries(value: unknown, ownerId: string): OrphanPhoto[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row: any) => row
    && typeof row.url === 'string' && ownDamagePhoto(row.url, ownerId)
    && typeof row.queuedAt === 'number' && Number.isFinite(row.queuedAt)
  ).slice(0, 200);
}

let serialized: Promise<void> = Promise.resolve();
function enqueueSerialized(work: () => Promise<void>): Promise<void> {
  serialized = serialized.catch(() => {}).then(work);
  return serialized;
}

/** Queue only abandoned proof uploaded for a fresh listing (never edit-mode server media). */
export async function markDamagePhotoAbandoned(ownerId: string, url: string): Promise<void> {
  const key = storageKey(ownerId);
  if (!key || !ownDamagePhoto(url, ownerId)) return;
  await enqueueSerialized(async () => {
    const queued = validEntries(JSON.parse((await AsyncStorage.getItem(key)) || '[]'), ownerId);
    if (queued.some(row => row.url === url)) return;
    queued.push({ url, queuedAt: Date.now() });
    await AsyncStorage.setItem(key, JSON.stringify(queued));
  });
}

/**
 * Remove only mature, owner-scoped, genuinely unreferenced media. Callers
 * MUST include both current and persisted draft/listing references in keep.
 * The storage helper independently re-checks the Supabase auth user/path.
 * Failures remain queued; never erase the recovery ledger on a network error.
 */
export async function cleanAbandonedDamagePhotos(
  ownerId: string, keep: ReadonlySet<string>, now = Date.now(),
): Promise<number> {
  const key = storageKey(ownerId);
  if (!key) return 0;
  let removed = 0;
  await enqueueSerialized(async () => {
    const queued = validEntries(JSON.parse((await AsyncStorage.getItem(key)) || '[]'), ownerId);
    const remaining: OrphanPhoto[] = [];
    for (const item of queued) {
      if (keep.has(item.url) || now - item.queuedAt < GRACE_MS) {
        remaining.push(item);
        continue;
      }
      try {
        await deletePublicStorageObject(item.url, 'listings');
        removed += 1;
      } catch {
        // Offline, QA read-only or no permission: never drop a pending record.
        remaining.push(item);
      }
    }
    await AsyncStorage.setItem(key, JSON.stringify(remaining));
  });
  return removed;
}
