import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { DamageZone3D } from './damageZones';

// ── Assets resolved once at module level so require() runs at build time ──────
const HTML_MODULE = require('../../assets/3d/viewer.html');
const GLB_MODULE  = require('../../assets/3d/vehicle.glb');
// Bundled, dependency-free Three.js + GLTFLoader + OrbitControls (see
// scripts/three-bundle-entry.mjs) — spliced into viewer.html in place of the
// CDN import so the viewer works fully offline.
const THREE_BUNDLE_MODULE = require('../../assets/3d/three-bundle.txt');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThreeDVehicleViewerProps {
  zones: DamageZone3D[];
  selectedZone: string | null;
  markedZones: string[];
  onZoneClick: (zoneLabel: string) => void;
  onZoneHide?: (zoneId: string) => void;
  onZonePhoto?: (zoneId: string, imageUri: string) => void;
  height?: number;
  /** Friendly body type label shown in the model badge (e.g. "SUV", "Hatchback").
   *  The GLB model itself doesn't change shape per body type yet — this only
   *  keeps the on-screen label honest about what vehicle the listing is. */
  bodyTypeLabel?: string;
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
  bodyTypeLabel,
}: ThreeDVehicleViewerProps) {
  const webViewRef = useRef<WebView>(null);

  // viewerHtml drives whether the WebView mounts at all; null = still loading
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Zone-level actions — id-keyed so they survive independently of `markedZones`
  const [hiddenZones, setHiddenZones] = useState<Set<string>>(new Set());
  const [zonePhotos, setZonePhotos] = useState<Record<string, string>>({});
  const [pillZoneId, setPillZoneId] = useState<string | null>(null);

  // Live screen position of each 3D-positioned zone, projected through the
  // WebView's camera every few frames — see viewer.html's postZonePositions.
  // Only zones with a `box` (exterior) fraction get an entry here; interior
  // zones have no exterior 3D position and are never rendered as hotspots.
  const [zoneScreenPos, setZoneScreenPos] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});
  const hotspotZones = zones.filter((z) => z.box);
  const hotspotZonesRef = useRef(hotspotZones);
  hotspotZonesRef.current = hotspotZones;

  // ── Load viewer.html + the vendored Three.js bundle on mount ────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const htmlAsset = Asset.fromModule(HTML_MODULE);
        const bundleAsset = Asset.fromModule(THREE_BUNDLE_MODULE);
        await Promise.all([htmlAsset.downloadAsync(), bundleAsset.downloadAsync()]);
        const [html, threeBundle] = await Promise.all([
          FileSystem.readAsStringAsync(htmlAsset.localUri!),
          FileSystem.readAsStringAsync(bundleAsset.localUri!),
        ]);
        // A function replacer avoids String.prototype.replace's special
        // $-pattern handling (e.g. a literal "$&" in the minified bundle
        // gets read as "insert matched substring" and corrupts the splice).
        const spliced = html.replace('/*__THREE_BUNDLE__*/', () => threeBundle);
        if (!cancelled) setViewerHtml(spliced);
      } catch (e: any) {
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

      const zonesForWire = hotspotZonesRef.current.map((z) => ({ id: z.id, ...z.box }));
      webViewRef.current?.injectJavaScript(
        'window.setZones(' + JSON.stringify(JSON.stringify(zonesForWire)) + '); true;'
      );
    } catch {
      // The viewer.html error overlay handles the visible failure state
    }
  }, []);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'zonePositions' && Array.isArray(msg.positions)) {
        setZoneScreenPos((prev) => {
          const next = { ...prev };
          for (const p of msg.positions) next[p.id] = { x: p.x, y: p.y, visible: p.visible };
          return next;
        });
      }
    } catch {
      // Ignore malformed messages
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
          onMessage={handleWebViewMessage}
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

      {/* Generic-model disclosure banner — deliberately prominent, not a small
          corner label, so it's easy to notice regardless of the viewer's age. */}
      <View style={styles.disclosureBanner} pointerEvents="none">
        <Ionicons name="information-circle" size={16} color={Colors.warning} style={{ marginRight: 6 }} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.disclosureText} numberOfLines={2}>
          Generic {bodyTypeLabel || 'vehicle'} shape shown for reference — your car's actual panels may look different.
        </Text>
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
        {hotspotZones.map((zone) => {
          const screenPos = zoneScreenPos[zone.id];
          // Nothing projected yet (viewer/model still loading) or the zone is
          // on the far side of the car / off-screen from the current angle.
          if (!screenPos || !screenPos.visible) return null;

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
                  left: `${screenPos.x}%` as any,
                  top:  `${screenPos.y}%` as any,
                },
              ]}
              onPress={() => handleHotspotPress(zone)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`${zone.label}${isMarked ? ' (damage marked)' : ''}`}
              accessibilityRole="button"
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
                  <Ionicons name="camera" size={8} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Action pill for the currently tapped zone — follows the zone's
            live projected position so it stays anchored while orbiting */}
        {pillZone && zoneScreenPos[pillZone.id]?.visible && (
          <View
            style={[
              styles.pill,
              {
                left: `${zoneScreenPos[pillZone.id].x}%` as any,
                top: `${zoneScreenPos[pillZone.id].y}%` as any,
                marginTop: zoneScreenPos[pillZone.id].y > 65 ? -66 : 18,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.pillBtn, markedZones.includes(pillZone.label) && styles.pillBtnActive]}
              onPress={() => onZoneClick(pillZone.label)}
              activeOpacity={0.7}
            >
              <Ionicons name="alert-circle-outline" size={13} color={Colors.white} />
              <Text style={styles.pillBtnText}>Mark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, hiddenZones.has(pillZone.id) && styles.pillBtnActive]}
              onPress={() => handleHideToggle(pillZone.id)}
              activeOpacity={0.7}
            >
              <Ionicons name={hiddenZones.has(pillZone.id) ? 'eye-off' : 'eye-off-outline'} size={13} color={Colors.white} />
              <Text style={styles.pillBtnText}>{hiddenZones.has(pillZone.id) ? 'Unhide' : 'Hide'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, zonePhotos[pillZone.id] && styles.pillBtnActive]}
              onPress={() => handlePhotoPick(pillZone.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={13} color={Colors.white} />
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
    backgroundColor: Colors.deepNearBlack,
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
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
  },

  // Generic-model disclosure banner
  disclosureBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,24,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha08,
  },
  disclosureText: {
    flex: 1,
    color: Colors.paleNearWhite_e4e4e7,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    lineHeight: 15,
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
    borderColor: Colors.lightRed_ff4444,
  },
  dotSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.white,
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
    borderColor: Colors.deepNearBlack,
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
    borderColor: Colors.whiteAlpha12,
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
    backgroundColor: Colors.accentAlpha22,
  },
  pillBtnText: {
    color: Colors.white,
    fontSize: FontSize.size9,
    fontFamily: FontFamily.medium,
  },

  // Hint bar
  hint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: Colors.blackAlpha45,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: FontSize.size10,
    fontFamily: FontFamily.regular,
  },
});
