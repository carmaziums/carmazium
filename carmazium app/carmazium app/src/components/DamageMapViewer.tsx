import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

interface DamageRecord {
  id: string;
  part: string;
  type: string;
  size: string;
  coords: { x: number; y: number; view: string };
}

interface Props {
  records: DamageRecord[];
  isLoading: boolean;
}

const PIN_COLORS: Record<string, string> = {
  Scratch: Colors.warning,   // amber
  Scuff: Colors.infoBlue,     // blue
  Dent: Colors.error,      // red
};

const getPinColor = (type: string): string => PIN_COLORS[type] ?? Colors.textMuted;

const VIEW_ORDER: string[] = ['FRONT', 'SIDE', 'REAR', 'TOP', 'INTERIOR'];

const hasResolvedCoords = (r: DamageRecord): boolean =>
  !!r.coords && typeof r.coords.x === 'number' && typeof r.coords.y === 'number' && typeof r.coords.view === 'string';

export const DamageMapViewer: React.FC<Props> = ({ records, isLoading }) => {
  const validRecords = records.filter(r => {
    if (hasResolvedCoords(r)) return true;
    if (__DEV__) console.warn(`[DamageMapViewer] skipping damage record with unresolved coords for part "${r.part}"`, r);
    return false;
  });
  const viewsWithRecords = VIEW_ORDER.filter(v => validRecords.some(r => r.coords.view === v));
  const [activeView, setActiveView] = useState<string>(viewsWithRecords[0] ?? 'FRONT');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View
        style={[
          styles.skeletonRect,
          { backgroundColor: Colors.whiteAlpha06, borderRadius: 12, height: 180 },
        ]}
      />
    );
  }

  if (validRecords.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="shield-checkmark-outline" size={22} color={Colors.success} />
        <View style={styles.emptyTextBlock}>
          <Text style={styles.emptyTitle}>No damage recorded</Text>
          <Text style={styles.emptySubtitle}>Vehicle checked clean</Text>
        </View>
      </View>
    );
  }

  const pinsForView = validRecords.filter(r => r.coords.view === activeView);
  const selectedPin = validRecords.find(r => r.id === selectedPinId) ?? null;

  return (
    <View>
      {/* View tabs */}
      <View style={styles.tabRow}>
        {viewsWithRecords.map(view => (
          <TouchableOpacity
            key={view}
            style={[styles.tabPill, activeView === view && styles.tabPillActive]}
            onPress={() => {
              setActiveView(view);
              setSelectedPinId(null);
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabPillText, activeView === view && styles.tabPillTextActive]}>
              {view}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Car view panel */}
      <View style={styles.carPanel}>
        {/* Simple car silhouette */}
        <View style={styles.silhouetteWrapper} pointerEvents="none">
          {/* roof */}
          <View style={styles.silhouetteRoof} />
          {/* body */}
          <View style={styles.silhouetteBody} />
        </View>

        {/* Damage pins */}
        {pinsForView.map(record => {
          const pinColor = getPinColor(record.type);
          const isSelected = selectedPinId === record.id;
          return (
            <TouchableOpacity
              key={record.id}
              style={[
                styles.pin,
                {
                  left: `${record.coords.x}%` as any,
                  top: `${record.coords.y}%` as any,
                  marginLeft: -8,
                  marginTop: -8,
                  backgroundColor: pinColor,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? Colors.white : 'rgba(255,255,255,0.4)',
                },
              ]}
              onPress={() =>
                setSelectedPinId(isSelected ? null : record.id)
              }
              activeOpacity={0.8}
            >
              <View style={styles.pinCenter} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detail row */}
      <View style={styles.detailRow}>
        {selectedPin ? (
          <>
            <View style={[styles.pinDot, { backgroundColor: getPinColor(selectedPin.type) }]} />
            <Text style={styles.detailText}>
              <Text style={styles.detailPart}>{selectedPin.part}</Text>
              {' · '}
              <Text>{selectedPin.type}</Text>
              {' · '}
              <Text>{selectedPin.size}</Text>
            </Text>
          </>
        ) : (
          <Text style={styles.detailPlaceholder}>Tap a pin to see damage details</Text>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        {(['Scratch', 'Scuff', 'Dent'] as const).map(type => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: getPinColor(type) }]} />
            <Text style={styles.legendLabel}>{type}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonRect: {
    width: '100%',
  },
  // Empty state
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.successAlpha06,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    borderRadius: 12,
    padding: 16,
  },
  emptyTextBlock: {
    flex: 1,
  },
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
  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  tabPillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabPillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  tabPillTextActive: {
    color: Colors.white,
  },
  // Car panel
  carPanel: {
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 10,
  },
  silhouetteWrapper: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: '15%',
    bottom: '15%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteRoof: {
    width: '55%',
    height: '38%',
    borderRadius: 16,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    marginBottom: -4,
    alignSelf: 'center',
  },
  silhouetteBody: {
    width: '100%',
    height: '52%',
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  // Pins
  pin: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  // Detail row
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
    marginBottom: 10,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  detailPart: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  detailPlaceholder: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
