import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { DamageZone3D } from './damageZones';

export interface ThreeDVehicleViewerProps {
  zones: DamageZone3D[];
  selectedZone: string | null;
  markedZones: string[];
  onZoneClick: (zoneLabel: string) => void;
  height?: number;
}

export function ThreeDVehicleViewer({
  zones,
  selectedZone,
  markedZones,
  onZoneClick,
  height = 280,
}: ThreeDVehicleViewerProps) {
  return (
    <View style={[styles.wrap, { height }]}>
      <View style={styles.carBody} />
      {zones.map((zone) => {
        const isMarked = markedZones.includes(zone.label);
        const isSelected = selectedZone === zone.label;
        return (
          <TouchableOpacity
            key={zone.id}
            style={[
              styles.hotspot,
              {
                left: `${zone.coords.x}%` as any,
                top: `${zone.coords.y}%` as any,
              },
              isMarked && styles.hotspotMarked,
              isSelected && styles.hotspotSelected,
            ]}
            onPress={() => onZoneClick(zone.label)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.dot,
              isMarked && styles.dotMarked,
              isSelected && styles.dotSelected,
            ]} />
          </TouchableOpacity>
        );
      })}
      <View style={styles.hint}>
        <Text style={styles.hintText}>Tap a zone below to mark damage</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#111113',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carBody: {
    width: '60%',
    height: '70%',
    backgroundColor: '#1E1E22',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A30',
  },
  hotspot: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hotspotMarked: {},
  hotspotSelected: {},
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.textMuted,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
  },
  dotMarked: {
    backgroundColor: Colors.error,
    borderColor: '#FF4444',
  },
  dotSelected: {
    backgroundColor: Colors.accent,
    borderColor: '#fff',
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  hint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: FontFamily.regular,
  },
});
