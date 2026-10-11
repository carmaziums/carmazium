import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ThreeDVehicleViewer } from './ThreeDVehicleViewer';
import { DAMAGE_ZONES_3D } from './damageZones';
import { DamageViewerErrorBoundary } from './DamageViewerErrorBoundary';

interface DamageRecord {
  id: string;
  part: string;
  type: string;
  size?: string | null;
  imageUrl?: string | null;
  coords?: { x?: number; y?: number; view?: string;
    surfacePoint?: { fx: number; fy: number; fz: number } } | null;
}

interface Props {
  records: DamageRecord[];
  isLoading: boolean;
  bodyTypeLabel?: string;
  /** True when the /damage fetch itself failed (network/auth/5xx) — distinct
   *  from a genuinely empty `records` array. Previously any fetch failure
   *  was swallowed and rendered identically to "no damage recorded," which
   *  is indistinguishable from the 3D viewer failing to initialize
   *  (mobile-production-readiness-plan.md F41). */
  hasError?: boolean;
  onRetry?: () => void;
  onInteractionChange?: (active: boolean) => void;
}

const PIN_COLORS: Record<string, string> = {
  SCRATCH: Colors.warning,
  SCUFF: Colors.warning,
  DENT: Colors.error,
  CRACK: Colors.error,
  OTHER: Colors.accent,
};

const getType = (type: string) => String(type || 'OTHER').split(' - ')[0].trim().toUpperCase();
const getDescription = (type: string) => String(type || '').includes(' - ')
  ? String(type).slice(String(type).indexOf(' - ') + 3) : '';
const getPinColor = (type: string): string => PIN_COLORS[getType(type)] ?? Colors.textMuted;

const validSurfacePoint = (value: unknown): value is { fx: number; fy: number; fz: number } => {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return ['fx', 'fy', 'fz'].every(key => typeof p[key] === 'number'
    && Number.isFinite(p[key]) && (p[key] as number) >= 0 && (p[key] as number) <= 1);
};

const formatPart = (part: string): string =>
  DAMAGE_ZONES_3D.find(z => z.id === part)?.label ??
  part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Web parity note: web's buyer-facing listing page (src/app/buy-cars/[slug]/page.tsx)
// renders the real interactive ThreeDVehicleViewer plus a damage list below it, synced
// by selection — this mirrors that layout instead of the flat 2D DamageMapViewer that
// used to render here (see mobile-production-readiness-plan.md F8).
export const BuyerDamageViewer: React.FC<Props> = ({ records, isLoading, bodyTypeLabel, hasError, onRetry, onInteractionChange }) => {
  const [selectedDamageId, setSelectedDamageId] = useState<string | null>(null);

  if (isLoading) {
    return <View style={[styles.skeletonRect, { height: 280 }]} />;
  }

  if (hasError) {
    return (
      <View style={styles.errorState}>
        <Ionicons name="alert-circle-outline" size={22} color={Colors.warning} />
        <View style={styles.emptyTextBlock}>
          <Text style={styles.emptyTitle}>Couldn't load damage info</Text>
          <Text style={styles.emptySubtitle}>Check your connection and try again</Text>
        </View>
        {onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.75}>
            <Ionicons name="refresh" size={14} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const markedZoneLabels = records
    .map(r => DAMAGE_ZONES_3D.find(z => z.id === r.part)?.label)
    .filter((l): l is string => !!l);
  const pins = records.flatMap((record, index) => validSurfacePoint(record.coords?.surfacePoint)
    ? [{
      id: record.id,
      number: index + 1,
      point: record.coords!.surfacePoint!,
      type: getType(record.type) as 'SCRATCH' | 'SCUFF' | 'DENT' | 'CRACK' | 'OTHER',
      zone: formatPart(record.part),
      hasPhoto: Boolean(record.imageUrl),
    }] : []);
  const selectedRecord = records.find(record => record.id === selectedDamageId) ?? null;
  const selectedZone = selectedRecord
    ? DAMAGE_ZONES_3D.find(zone => zone.id === selectedRecord.part)?.label ?? null : null;
  const selectZone = (label: string) => {
    const zone = DAMAGE_ZONES_3D.find(z => z.label === label);
    const match = records.find(record => record.part === zone?.id);
    setSelectedDamageId(previous => previous === match?.id ? null : match?.id ?? null);
  };

  // The 3D model always renders — even with zero damage records — so the
  // section never looks broken/missing. Copy adapts instead of the model
  // disappearing (Prompt 6). There's only one GLB model in the app
  // regardless of body type (CLAUDE.md); bodyTypeLabel is just the on-screen
  // text badge, so "defaulting to a generic body model" is already the only
  // behavior that exists.
  return (
    <View>
      <DamageViewerErrorBoundary height={280}>
        <ThreeDVehicleViewer
          zones={DAMAGE_ZONES_3D}
          selectedZone={selectedZone}
          markedZones={markedZoneLabels}
          onZoneClick={selectZone}
          damagePins={pins}
          selectedDamageId={selectedDamageId}
          onDamagePinPress={id => setSelectedDamageId(previous => previous === id ? null : id)}
          bodyTypeLabel={bodyTypeLabel}
          readOnly
          onInteractionChange={onInteractionChange}
        />
      </DamageViewerErrorBoundary>

      {records.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark-outline" size={22} color={Colors.success} />
          <View style={styles.emptyTextBlock}>
            <Text style={styles.emptyTitle}>No damage reported by the seller</Text>
            <Text style={styles.emptySubtitle}>This is the seller’s report, not an independent inspection.</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.listHeading}>
            {records.length} reported damage{records.length !== 1 ? 's' : ''} · {pins.length} positioned on 3D. Tap a number or a record to inspect.
          </Text>
          <View style={styles.list}>
            {records.map((record, index) => {
              const isSelected = selectedDamageId === record.id;
              return (
                <TouchableOpacity
                  key={record.id}
                  style={[styles.listRow, isSelected && styles.listRowSelected]}
                  activeOpacity={0.75}
                  onPress={() => setSelectedDamageId(previous => previous === record.id ? null : record.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Inspect damage ${index + 1} on ${formatPart(record.part)}`}
                >
                  {record.imageUrl ? (
                    <Image
                      source={{ uri: record.imageUrl }}
                      style={styles.thumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.pinDot, { backgroundColor: getPinColor(record.type) }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>#{index + 1} · {formatPart(record.part)}</Text>
                    <Text style={styles.rowSub}>
                      {getType(record.type)}{getDescription(record.type) ? ` · ${getDescription(record.type)}` : ''}
                      {record.size ? ` · ${record.size}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedRecord && (
            <View style={styles.inspectionPanel} accessibilityLabel="Selected vehicle damage evidence">
              <Text style={styles.rowTitle}>{formatPart(selectedRecord.part)} · {getType(selectedRecord.type)}</Text>
              {getDescription(selectedRecord.type) ? (
                <Text style={styles.rowSub}>{getDescription(selectedRecord.type)}</Text>
              ) : <Text style={styles.rowSub}>No additional description supplied.</Text>}
              {selectedRecord.imageUrl ? (
                <Image source={{ uri: selectedRecord.imageUrl }}
                  style={styles.inspectionImage} contentFit="contain"
                  cachePolicy="memory-disk"
                  accessibilityLabel={`Seller photo evidence for ${formatPart(selectedRecord.part)}`} />
              ) : <Text style={styles.rowSub}>No damage photo supplied by the seller.</Text>}
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonRect: {
    width: '100%',
    backgroundColor: Colors.whiteAlpha06,
    borderRadius: 12,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.successAlpha06,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  listHeading: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    marginTop: 12,
    marginBottom: 8,
  },
  errorState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    borderRadius: 12,
    padding: 16,
  },
  retryBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.whiteAlpha08,
  },
  emptyTextBlock: { flex: 1 },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  list: {
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  listRowSelected: {
    backgroundColor: Colors.accentAlpha06,
    borderColor: Colors.accentAlpha25,
  },
  inspectionPanel: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    borderRadius: 12,
    backgroundColor: Colors.whiteAlpha04,
    padding: 12,
    gap: 6,
  },
  inspectionImage: {
    width: '100%',
    height: 220,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: Colors.bgTertiary,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.bgTertiary,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  rowTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  rowSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
