import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { DamageZone3D } from './damageZones';

// ── Assets resolved once at module level so require() runs at build time ──────
const HTML_MODULE = require('../../assets/3d/viewer.html');
const GLB_MODULE  = require('../../assets/3d/vehicle.glb');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThreeDVehicleViewerProps {
  zones: DamageZone3D[];
  selectedZone: string | null;
  markedZones: string[];
  onZoneClick: (zoneLabel: string) => void;
  onZoneHide?: (zoneId: string) => void;
  onZonePhoto?: (zoneId: string, imageUri: string) => void;
  height?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ThreeDVehicleViewer({
  zones,
  selectedZone,
  markedZones,
  onZoneClick,
  onZoneHide,
  onZonePhoto,
  height = 280,
}: ThreeDVehicleViewerProps) {
  const webViewRef = useRef<WebView>(null);

  // viewerHtml drives whether the WebView mounts at all; null = still loading
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Zone-level actions — id-keyed so they survive independently of `markedZones`
  const [hiddenZones, setHiddenZones] = useState<Set<string>>(new Set());
  const [zonePhotos, setZonePhotos] = useState<Record<string, string>>({});
  const [pillZoneId, setPillZoneId] = useState<string | null>(null);

  // ── Load viewer.html from the bundled asset on mount ────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const htmlAsset = Asset.fromModule(HTML_MODULE);
        await htmlAsset.downloadAsync();
        const html = await FileSystem.readAsStringAsync(htmlAsset.localUri!);
        if (!cancelled) setViewerHtml(html);
      } catch {
        if (!cancelled) setLoadError('Could not initialise 3D viewer');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Once the WebView has loaded the HTML, inject the GLB as a data URL ───────
  const handleWebViewLoad = useCallback(async () => {
    try {
      const glbAsset = Asset.fromModule(GLB_MODULE);
      await glbAsset.downloadAsync();
      if (!glbAsset.localUri) throw new Error('no localUri for GLB');

      const base64 = await FileSystem.readAsStringAsync(glbAsset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Base64 uses only A-Za-z0-9+/= — safe inside a JS double-quoted string
      webViewRef.current?.injectJavaScript(
        'window.loadGLB("data:model/gltf-binary;base64,' + base64 + '"); true;'
      );
    } catch {
      // The viewer.html error overlay handles the visible failure state
    }
  }, []);

  // ── Zone actions: mark / hide / photo ────────────────────────────────────────

  const handleHotspotPress = useCallback((zone: DamageZone3D) => {
    onZoneClick(zone.label);
    setPillZoneId(zone.id);
  }, [onZoneClick]);

  const handleHideToggle = useCallback((zoneId: string) => {
    setHiddenZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId); else next.add(zoneId);
      return next;
    });
    onZoneHide?.(zoneId);
  }, [onZoneHide]);

  const handlePhotoPick = useCallback(async (zoneId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setZonePhotos((prev) => ({ ...prev, [zoneId]: uri }));
      onZonePhoto?.(zoneId, uri);
    }
    setPillZoneId(null);
  }, [onZonePhoto]);

  const pillZone = zones.find((z) => z.id === pillZoneId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.wrap, { height }]}>

      {/* 3D viewer — only mounts once the HTML string is ready */}
      {viewerHtml ? (
        <WebView
          ref={webViewRef}
          source={{ html: viewerHtml }}
          onLoad={handleWebViewLoad}
          scrollEnabled={false}
          javaScriptEnabled
          originWhitelist={['*']}
          style={StyleSheet.absoluteFillObject}
          androidLayerType="hardware"
          allowsInlineMediaPlayback
        />
      ) : loadError ? (
        <View style={styles.errorState} pointerEvents="none">
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={Colors.accent} size="small" />
        </View>
      )}

      {/* Model identity badge — top-left corner */}
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>vehicle.glb · SUV</Text>
      </View>

      {/* Tap-outside-to-dismiss backdrop — only present while a pill is open,
          so orbit drag on the WebView is unaffected the rest of the time */}
      {pillZone && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => setPillZoneId(null)}
        />
      )}

      {/* Zone hotspot overlay
          pointerEvents="box-none" lets touches that miss a hotspot fall
          through to the WebView so orbit drag still works */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {zones.map((zone) => {
          const isMarked   = markedZones.includes(zone.label);
          const isSelected = selectedZone === zone.label;
          const isHidden   = hiddenZones.has(zone.id);
          const hasPhoto   = !!zonePhotos[zone.id];
          return (
            <TouchableOpacity
              key={zone.id}
              style={[
                styles.hotspot,
                {
                  left: `${zone.coords.x}%` as any,
                  top:  `${zone.coords.y}%` as any,
                },
              ]}
              onPress={() => handleHotspotPress(zone)}
              activeOpacity={0.7}
            >
              {isHidden ? (
                <View style={styles.dotHidden} />
              ) : (
                <View style={[
                  styles.dot,
                  isMarked   && styles.dotMarked,
                  isSelected && styles.dotSelected,
                ]} />
              )}
              {hasPhoto && (
                <View style={styles.photoBadge}>
                  <Ionicons name="camera" size={8} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Action pill for the currently tapped zone */}
        {pillZone && (
          <View
            style={[
              styles.pill,
              {
                left: `${pillZone.coords.x}%` as any,
                top: `${pillZone.coords.y}%` as any,
                marginTop: pillZone.coords.y > 65 ? -66 : 18,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.pillBtn, markedZones.includes(pillZone.label) && styles.pillBtnActive]}
              onPress={() => onZoneClick(pillZone.label)}
              activeOpacity={0.7}
            >
              <Ionicons name="alert-circle-outline" size={13} color="#fff" />
              <Text style={styles.pillBtnText}>Mark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, hiddenZones.has(pillZone.id) && styles.pillBtnActive]}
              onPress={() => handleHideToggle(pillZone.id)}
              activeOpacity={0.7}
            >
              <Ionicons name={hiddenZones.has(pillZone.id) ? 'eye-off' : 'eye-off-outline'} size={13} color="#fff" />
              <Text style={styles.pillBtnText}>{hiddenZones.has(pillZone.id) ? 'Unhide' : 'Hide'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, zonePhotos[pillZone.id] && styles.pillBtnActive]}
              onPress={() => handlePhotoPick(pillZone.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={13} color="#fff" />
              <Text style={styles.pillBtnText}>{zonePhotos[pillZone.id] ? 'Retake' : 'Photo'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Hint */}
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>Drag to rotate · Tap a zone to mark damage</Text>
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#111113',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },

  // Loading / error states
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
  },

  // Model badge
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeText: {
    color: '#A0A0AB',
    fontSize: 10,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.5,
  },

  // Zone hotspots (same sizing as the original SVG overlay)
  hotspot: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  dotHidden: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  photoBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#111113',
  },

  // Zone action pill
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    width: 186,
    marginLeft: -93,
    backgroundColor: 'rgba(17,17,19,0.96)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 4,
    gap: 4,
    zIndex: 20,
  },
  pillBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 2,
  },
  pillBtnActive: {
    backgroundColor: 'rgba(220,31,38,0.22)',
  },
  pillBtnText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: FontFamily.medium,
  },

  // Hint bar
  hint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: FontFamily.regular,
  },
});
