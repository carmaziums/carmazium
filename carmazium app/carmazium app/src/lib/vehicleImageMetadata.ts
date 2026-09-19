export type VehicleImageCategory = 'EXTERIOR' | 'INTERIOR' | 'DAMAGE' | 'UNASSIGNED';

const VIEW_MARKER = '#cm-photo=';

function inferCategory(src: string): VehicleImageCategory {
  const clean = src.toLowerCase();
  if (clean.includes('/exterior/')) return 'EXTERIOR';
  if (clean.includes('/interior/')) return 'INTERIOR';
  if (clean.includes('/damage/')) return 'DAMAGE';
  return 'UNASSIGNED';
}

export function parseVehicleImageMetadata(value?: string | null): {
  src: string;
  category: VehicleImageCategory;
} {
  const raw = value?.trim() || '';
  if (!raw) return { src: '', category: 'UNASSIGNED' };

  const markerIndex = raw.lastIndexOf(VIEW_MARKER);
  if (markerIndex < 0) {
    return { src: raw, category: inferCategory(raw) };
  }

  const src = raw.slice(0, markerIndex);
  const values = raw.slice(markerIndex + VIEW_MARKER.length).split(',');
  const categoryValue = values[4];
  const category: VehicleImageCategory = (
    categoryValue === 'EXTERIOR'
    || categoryValue === 'INTERIOR'
    || categoryValue === 'DAMAGE'
    || categoryValue === 'UNASSIGNED'
  ) ? categoryValue : inferCategory(src);

  return { src, category };
}

export function encodeVehicleImageCategory(
  value: string,
  category: VehicleImageCategory,
): string {
  const raw = value?.trim() || '';
  if (!raw) return '';

  const markerIndex = raw.lastIndexOf(VIEW_MARKER);
  if (markerIndex < 0) {
    return `${raw}${VIEW_MARKER}cover,50,50,1.00,${category}`;
  }

  const src = raw.slice(0, markerIndex);
  const values = raw.slice(markerIndex + VIEW_MARKER.length).split(',');
  const fit = values[0] === 'contain' ? 'contain' : 'cover';
  const x = Number.isFinite(Number(values[1])) ? values[1] : '50';
  const y = Number.isFinite(Number(values[2])) ? values[2] : '50';
  const zoom = Number.isFinite(Number(values[3])) ? values[3] : '1.00';

  return `${src}${VIEW_MARKER}${fit},${x},${y},${zoom},${category}`;
}
