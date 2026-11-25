import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ThreeDVehicleViewer } from './ThreeDVehicleViewer';
import { DAMAGE_ZONES_3D } from './damageZones';
import { buildBuyerDamagePins, type DamagePoint } from '../../lib/damageMarkers';
import { DamageViewerErrorBoundary } from './DamageViewerErrorBoundary';

interface DamageRecord {
  id: string;
  part: string;
  type: string;
  size?: string | null;
  imageUrl?: string | null;
  coords?: { surfacePoint?: DamagePoint | null } | null;
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
}

const PIN_COLORS: Record<string, string> = {
  Scratch: Colors.warning,
  Scuff: Colors.infoBlue,
  Dent: Colors.error,
};

const getPinColor = (type: string): string => PIN_COLORS[type] ?? Colors.textMuted;

const formatPart = (part: string): string =>
  DAMAGE_ZONES_3D.find(z => z.id === part)?.label ??
  part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Web parity note: web's buyer-facing listing page (src/app/buy-cars/[slug]/page.tsx)
// renders the real interactive ThreeDVehicleViewer plus a damage list below it, synced
// by selection — this mirrors that layout instead of the flat 2D DamageMapViewer that
// used to render here (see mobile-production-readiness-plan.md F8).
export const BuyerDamageViewer: React.FC<Props> = ({ records, isLoading, bodyTypeLabel, hasError, onRetry }) => {
  const [selectedDamageId, setSelectedDamageId] = useState<string | null>(null);
  const pins = buildBuyerDamagePins(hasError || isLoading ? [] : records);
  const toggleRecord = (id: string) => setSelectedDamageId(previous => previous === id ? null : id);

  return (
    <View>
      <DamageViewerErrorBoundary height={280}>
        <ThreeDVehicleViewer
          pins={pins}
          selectedDamageId={selectedDamageId}
          onDamagePinPress={toggleRecord}
          bodyTypeLabel={bodyTypeLabel}
        />
      </DamageViewerErrorBoundary>

      {isLoading ? <Text style={styles.listHeading}>Loading damage records...</Text> : hasError ? (
        <View style={styles.errorState}>
        <Ionicons name="alert-circle-outline" size={22} color={Colors.warning} />
        <View style={styles.emptyTextBlock}>
          <Text style={styles.emptyTitle}>Couldn't load damage info</Text>
          <Text style={styles.emptySubtitle}>Damage records are unavailable. The model above does not confirm the vehicle condition.</Text>
        </View>
        {onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.75}>
            <Ionicons name="refresh" size={14} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark-outline" size={22} color={Colors.success} />
          <View style={styles.emptyTextBlock}>
            <Text style={styles.emptyTitle}>No damage reported by the seller</Text>
            <Text style={styles.emptySubtitle}>No damage details were provided; this is not an independent inspection.</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.listHeading}>
            {records.length} damage report{records.length !== 1 ? 's' : ''} from seller — tap a marked point or its report to see details
          </Text>
          <View style={styles.list}>
            {records.map(record => {
              const isSelected = selectedDamageId === record.id;
              return (
                <TouchableOpacity
                  key={record.id}
                  style={[styles.listRow, isSelected && styles.listRowSelected]}
                  activeOpacity={0.75}
                  onPress={() => toggleRecord(record.id)}
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
                    <Text style={styles.rowTitle}>{formatPart(record.part)}</Text>
                    <Text style={styles.rowSub}>
                      {record.type}{record.size ? ` — ${record.size}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
