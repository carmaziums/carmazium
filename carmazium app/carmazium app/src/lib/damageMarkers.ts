/**
 * Translate saved damage records into buyer-facing 3D markers.
 *
 * Exact surfacePoint coordinates are preserved verbatim. Historical/manual
 * damage records may have a named exterior panel but no saved 3D hit; in that
 * case show a clearly labelled APPROXIMATE panel marker, never an invented
 * precise impact location. Unknown/custom and interior panels stay in the
 * report cards until the seller marks a real surface point.
 */
export type DamagePoint = { fx: number; fy: number; fz: number }

export interface PublicDamageRecord {
  id?: string | null
  part?: string | null
  type?: string | null
  imageUrl?: string | null
  coords?: { surfacePoint?: DamagePoint | null } | null
}

export interface BuyerDamagePin {
  id: string
  number: number
  zone: string
  point: DamagePoint
  type: string
  hasPhoto: boolean
  approximate: boolean
}

const panelPoints: Record<string, readonly [number, number, number]> = {
  'front-bumper': [0.5, 0.23, 0.98],
  'ns-headlight': [0.23, 0.43, 0.96],
  'os-headlight': [0.77, 0.43, 0.96],
  bonnet: [0.5, 0.65, 0.79],
  'nsf-wing': [0.08, 0.48, 0.76],
  'osf-wing': [0.92, 0.48, 0.76],
  windshield: [0.5, 0.77, 0.65],
  'rear-windshield': [0.5, 0.78, 0.35],
  roof: [0.5, 0.96, 0.5],
  'front-left-door': [0.07, 0.5, 0.58],
  'front-right-door': [0.93, 0.5, 0.58],
  'rear-left-door': [0.07, 0.5, 0.35],
  'rear-right-door': [0.93, 0.5, 0.35],
  'ns-sill': [0.07, 0.19, 0.5],
  'os-sill': [0.93, 0.19, 0.5],
  'nsr-quarter': [0.08, 0.49, 0.22],
  'osr-quarter': [0.92, 0.49, 0.22],
  boot: [0.5, 0.53, 0.08],
  'ns-rear-light': [0.24, 0.42, 0.03],
  'os-rear-light': [0.76, 0.42, 0.03],
  'rear-bumper': [0.5, 0.22, 0.02],
  'nsf-wheel': [0.05, 0.19, 0.74],
  'osf-wheel': [0.95, 0.19, 0.74],
  'nsr-wheel': [0.05, 0.19, 0.27],
  'osr-wheel': [0.95, 0.19, 0.27],
}

const partAliases: Record<string, string> = {
  'boot lid': 'boot', 'trunk': 'boot', 'trunk lid': 'boot',
  'tailgate': 'boot', 'rear hatch': 'boot',
  'back bumper': 'rear-bumper', 'rear bumper': 'rear-bumper',
  'front bumper': 'front-bumper',
  'hood': 'bonnet', 'bonnet hood': 'bonnet',
  'windscreen': 'windshield', 'front windscreen': 'windshield',
  'rear windscreen': 'rear-windshield', 'rear window': 'rear-windshield',
  'front left door': 'front-left-door', 'front right door': 'front-right-door',
  'rear left door': 'rear-left-door', 'rear right door': 'rear-right-door',
}

function normalizedPanel(part: string): string {
  const simplified = part.toLowerCase().trim().replace(/[_-]/g, ' ').replace(/\s+/g, ' ')
  return partAliases[simplified] ?? simplified.replace(/ /g, '-')
}

function validPoint(value: DamagePoint | null | undefined): value is DamagePoint {
  return Boolean(value && (['fx', 'fy', 'fz'] as const).every(key =>
    typeof value[key] === 'number' && Number.isFinite(value[key])
    && value[key] >= 0 && value[key] <= 1))
}

export function buildBuyerDamagePins(records: readonly PublicDamageRecord[]): BuyerDamagePin[] {
  return records.flatMap((record, index) => {
    const zone = String(record.part ?? '')
    const exactPoint = record.coords?.surfacePoint
    const anchor = !validPoint(exactPoint) ? panelPoints[normalizedPanel(zone)] : undefined
    if (!validPoint(exactPoint) && !anchor) return []
    const point: DamagePoint = validPoint(exactPoint)
      ? { fx: exactPoint.fx, fy: exactPoint.fy, fz: exactPoint.fz }
      : { fx: anchor![0], fy: anchor![1], fz: anchor![2] }
    return [{
      id: String(record.id ?? `damage-${index}`),
      number: index + 1,
      zone,
      point,
      type: String(record.type ?? '').split(' - ')[0].toUpperCase(),
      hasPhoto: Boolean(record.imageUrl),
      approximate: !validPoint(exactPoint),
    }]
  })
}
