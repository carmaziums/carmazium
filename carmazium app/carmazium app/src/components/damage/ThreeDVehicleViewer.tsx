import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, { Path, Ellipse, Rect } from 'react-native-svg';
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
      {/* Top-down car silhouette. viewBox 0 0 100 100 maps directly to the
          zone coords which are already expressed as %-of-container values. */}
      <Svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFillObject}
      >
        {/* Main car body */}
        <Path
          d="M 50 10 C 66 10 76 18 76 30 L 76 70 C 76 82 66 90 50 90 C 34 90 24 82 24 70 L 24 30 C 24 18 34 10 50 10 Z"
          fill="#1A1A22"
          stroke="#2D2D3C"
          strokeWidth="1.5"
        />
        {/* Bonnet / Hood */}
        <Path
          d="M 30 22 L 70 22 L 72 36 L 28 36 Z"
          fill="#111118"
          stroke="#252535"
          strokeWidth="0.7"
        />
        {/* Windscreen */}
        <Path
          d="M 28 36 L 72 36 L 70 48 L 30 48 Z"
          fill="#0A1520"
          stroke="#253545"
          strokeWidth="0.7"
        />
        {/* Cabin / Roof */}
        <Rect x="28" y="48" width="44" height="14" rx="2" fill="#0D0D18" stroke="#1F1F2F" strokeWidth="0.5" />
        {/* Rear window */}
        <Path
          d="M 30 62 L 70 62 L 72 74 L 28 74 Z"
          fill="#0A1520"
          stroke="#253545"
          strokeWidth="0.7"
        />
        {/* Boot / Trunk */}
        <Path
          d="M 28 74 L 72 74 L 70 86 L 30 86 Z"
          fill="#111118"
          stroke="#252535"
          strokeWidth="0.7"
        />
        {/* Front bumper accent */}
        <Path d="M 34 11 L 66 11" stroke="#DC1F26" strokeWidth="1" strokeOpacity="0.4" />
        {/* Rear bumper accent */}
        <Path d="M 34 89 L 66 89" stroke="#DC1F26" strokeWidth="1" strokeOpacity="0.4" />
        {/* Front-left wheel */}
        <Ellipse cx="15" cy="36" rx="7" ry="11" fill="#0A0A12" stroke="#1E1E2A" strokeWidth="1" />
        {/* Front-right wheel */}
        <Ellipse cx="85" cy="36" rx="7" ry="11" fill="#0A0A12" stroke="#1E1E2A" strokeWidth="1" />
        {/* Rear-left wheel */}
        <Ellipse cx="15" cy="66" rx="7" ry="11" fill="#0A0A12" stroke="#1E1E2A" strokeWidth="1" />
        {/* Rear-right wheel */}
        <Ellipse cx="85" cy="66" rx="7" ry="11" fill="#0A0A12" stroke="#1E1E2A" strokeWidth="1" />
      </Svg>

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
        <Text style={styles.hintText}>Tap a zone to mark damage</Text>
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
