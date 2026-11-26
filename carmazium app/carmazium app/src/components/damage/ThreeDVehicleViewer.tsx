import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useScrollLockStore } from '../../lib/scrollLock';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import type { BuyerDamagePin, DamagePoint } from '../../lib/damageMarkers';
import { selectDamageModel, type DamageModel } from '../../lib/damageModel';

// ── Assets resolved once at module level so require() runs at build time ──────
const HTML_MODULE = require('../../assets/3d/viewer.html');
const GLB_MODULES = {
  sedan: require('../../assets/3d/sedan.glb'),
  hatchback: require('../../assets/3d/hatchback.glb'),
  suv: require('../../assets/3d/suv.glb'),
};
const MESHOPT_MODULE = require('../../assets/3d/meshopt-decoder.txt');
// Bundled, dependency-free Three.js + GLTFLoader + OrbitControls (see
// scripts/three-bundle-entry.mjs) — spliced into viewer.html in place of the
// CDN import so the viewer works fully offline.
const THREE_BUNDLE_MODULE = require('../../assets/3d/three-bundle.txt');

// ── Module-level asset caches ───────────────────────────────────────────────
// This component gets fully unmounted and remounted very often — every
// wizard-step change AND every Exterior/Interior/Damage tab switch in
// SellCarFlowScreen, plus every fresh screen instance on the buyer side.
// Before this cache, EVERY mount re-downloaded + re-read the HTML template,
// the ~744KB Three.js bundle, and re-read + re-base64-encoded the ~2.4MB GLB
// from scratch, then threw away a brand-new native WebView instance on the
// next unmount. Rapid remounts (exactly what "going back and forth between
// steps" produces) is a known failure mode for RN WebView under that load —
// this was the root cause of the 3D model silently failing to (re)render
// (mobile-production-readiness-plan.md F41). Caching the resolved data at
// module scope means the expensive I/O/encoding happens once per app
// session — shared across every viewer instance, seller and buyer alike —
// and every remount after that only has to spin up a fresh WebView with
// already-ready data, not redo the disk work.
let cachedViewerHtmlPromise: Promise<string> | null = null;
function loadViewerHtml(): Promise<string> {
  if (!cachedViewerHtmlPromise) {
    cachedViewerHtmlPromise = (async () => {
      const htmlAsset = Asset.fromModule(HTML_MODULE);
      const bundleAsset = Asset.fromModule(THREE_BUNDLE_MODULE);
      const decoderAsset = Asset.fromModule(MESHOPT_MODULE);
      await Promise.all([htmlAsset.downloadAsync(), bundleAsset.downloadAsync(), decoderAsset.downloadAsync()]);
      const [html, threeBundle, decoder] = await Promise.all([
        FileSystem.readAsStringAsync(htmlAsset.localUri!),
        FileSystem.readAsStringAsync(bundleAsset.localUri!),
        FileSystem.readAsStringAsync(decoderAsset.localUri!),
      ]);
      // A function replacer avoids String.prototype.replace's special
      // $-pattern handling (e.g. a literal "$&" in the minified bundle
      // gets read as "insert matched substring" and corrupts the splice).
      return html.replace('/*__THREE_BUNDLE__*/', () => threeBundle).replace('/*__MESHOPT_DECODER__*/', () => decoder);
    })();
    // Don't cache a rejected attempt forever — let the next mount retry.
    cachedViewerHtmlPromise.catch(() => { cachedViewerHtmlPromise = null; });
  }
  return cachedViewerHtmlPromise;
}

let cachedGlbBase64Promise: Promise<string> | null = null;
let cachedModel: DamageModel | null = null;
function loadGlbBase64(model: DamageModel): Promise<string> {
  if (!cachedGlbBase64Promise || cachedModel !== model) {
    cachedModel = model;
    cachedGlbBase64Promise = (async () => {
      const glbAsset = Asset.fromModule(GLB_MODULES[model]);
      await glbAsset.downloadAsync();
      if (!glbAsset.localUri) throw new Error('no localUri for GLB');
      return FileSystem.readAsStringAsync(glbAsset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    })();
    const pending = cachedGlbBase64Promise;
    pending.catch(() => { if (cachedGlbBase64Promise === pending) { cachedGlbBase64Promise = null; cachedModel = null; } });
  }
  return cachedGlbBase64Promise;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThreeDVehicleViewerProps {
  pins: BuyerDamagePin[];
  selectedDamageId?: string | null;
  onSurfaceTap?: (point: DamagePoint) => void;
  onDamagePinPress?: (id: string) => void;
  height?: number;
  bodyTypeLabel?: string;
}

export function ThreeDVehicleViewer(props: ThreeDVehicleViewerProps) {
  const model = selectDamageModel(props.bodyTypeLabel);
  return <ThreeDVehicleViewerInstance key={model} {...props} model={model} />;
}

function ThreeDVehicleViewerInstance({ pins, selectedDamageId, onSurfaceTap, onDamagePinPress, height = 280, model }: ThreeDVehicleViewerProps & { model: DamageModel }) {
  const webViewRef = useRef<WebView>(null);
  const setScrollLocked = useScrollLockStore((st) => st.setLocked);
  const lockScroll = useCallback(() => setScrollLocked(true), [setScrollLocked]);
  const unlockScroll = useCallback(() => setScrollLocked(false), [setScrollLocked]);
  // Never leave the page frozen if the viewer unmounts mid-gesture.
  useEffect(() => () => setScrollLocked(false), [setScrollLocked]);

  // viewerHtml drives whether the WebView mounts at all; null = still loading
  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const transferStarted = useRef(false);
  const readyRef = useRef(false);
  const [modelReady, setModelReady] = useState(false);

  const [zoneScreenPos, setZoneScreenPos] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});
  const pinsRef = useRef(pins); pinsRef.current = pins;
  const tapRef = useRef(onSurfaceTap); tapRef.current = onSurfaceTap;
  const projectedZoneKey = JSON.stringify(pins.map(p => ({ id: p.id, ...p.point })));
  const editable = Boolean(onSurfaceTap);
  useEffect(() => {
    if (!viewerHtml || !webViewRef.current) return;
    webViewRef.current.injectJavaScript('if(window.setZones) window.setZones(' + JSON.stringify(projectedZoneKey) + '); if(window.setEditable) window.setEditable(' + editable + '); true;');
  }, [viewerHtml, projectedZoneKey, editable]);

  const [glbError, setGlbError] = useState(false);
  const fail = useCallback(() => {
    readyRef.current = false;
    generation.current++;
    setModelReady(false);
    setGlbError(true);
    setZoneScreenPos({});
    unlockScroll();
  }, [unlockScroll]);

  const retry = useCallback(() => {
    generation.current++;
    readyRef.current = false;
    transferStarted.current = false;
    setModelReady(false);
    setViewerHtml(null);
    setLoadError(null);
    setGlbError(false);
    setZoneScreenPos({});
    unlockScroll();
    setAttempt(value => value + 1);
  }, [unlockScroll]);

  useEffect(() => {
    let cancelled = false;
    loadViewerHtml()
      .then(html => { if (!cancelled) setViewerHtml(html); })
      .catch(() => { if (!cancelled) setLoadError('Could not initialise 3D viewer'); });
    return () => { cancelled = true; generation.current++; };
  }, [attempt]);

  useEffect(() => {
    if (modelReady || loadError || glbError) return;
    const timeout = setTimeout(fail, 45000);
    return () => clearTimeout(timeout);
  }, [attempt, modelReady, loadError, glbError, fail]);

  const sendModel = useCallback(async () => {
    if (transferStarted.current || !webViewRef.current) return;
    transferStarted.current = true;
    const request = generation.current;
    try {
      const base64 = await loadGlbBase64(model);
      if (generation.current !== request || !webViewRef.current) return;
      const chunks = base64.match(/.{1,65536}/g) || [];
      if (!chunks.length) throw new Error('Empty model');
      const view = webViewRef.current;
      view.injectJavaScript('window.beginModel(' + chunks.length + '); true;');
      for (let i = 0; i < chunks.length; i++) {
        view.injectJavaScript('window.appendModelChunk(' + i + ',' + JSON.stringify(chunks[i]) + '); true;');
      }
      const wireZones = pinsRef.current.map(p => ({ id: p.id, ...p.point }));
      view.injectJavaScript('window.setZones(' + JSON.stringify(JSON.stringify(wireZones)) + '); window.setEditable(' + Boolean(tapRef.current) + '); window.finishModel(); true;');
    } catch {
      if (generation.current === request) fail();
    }
  }, [fail, model]);

  const handleWebViewLoad = useCallback(() => {
    webViewRef.current?.injectJavaScript('if(window.reportViewerReady) window.reportViewerReady(); true;');
  }, []);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'viewerReady') { void sendModel(); return; }
      if (msg.type === 'viewerError') { fail(); return; }
      if (msg.type === 'modelReady') {
        readyRef.current = true;
        setModelReady(true);
        setGlbError(false);
        return;
      }
      if (msg.type === 'surfaceTap' && readyRef.current && tapRef.current) {
        const p = msg.point;
        if (p && [p.fx, p.fy, p.fz].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) tapRef.current(p);
        return;
      }
      if (msg.type === 'zonePositions' && readyRef.current && Array.isArray(msg.positions)) {
        setZoneScreenPos(prev => {
          const next: typeof prev = {};
          for (const p of msg.positions) next[p.id] = { x: p.x, y: p.y, visible: p.visible };
          return next;
        });
      }
    } catch { /* Ignore malformed messages. */ }
  }, [sendModel, fail]);

  return (
    <View>
      <View style={styles.disclosureBanner}><Ionicons name="information-circle" size={16} color={Colors.warning} /><Text style={styles.disclosureText}>Generic {model === 'suv' ? 'SUV' : model} reference model. Actual vehicle panels may differ.</Text></View>
    <View
      style={[styles.wrap, { height }]}
      // Hold the page still while a finger is on the model so drags orbit
      // the car instead of scrolling the screen (see lib/scrollLock.ts).
      onTouchStart={() => { if (readyRef.current) lockScroll(); }}
      onTouchEnd={unlockScroll}
      onTouchCancel={unlockScroll}
    >

      {/* 3D viewer — only mounts once the HTML string is ready */}
      {viewerHtml ? (
        <WebView
          key={attempt}
          ref={webViewRef}
          source={{ html: viewerHtml }}
          onLoad={handleWebViewLoad}
          onMessage={handleWebViewMessage}
          onError={fail}
          onContentProcessDidTerminate={fail}
          onRenderProcessGone={fail}
          scrollEnabled={false}
          javaScriptEnabled
          originWhitelist={['*']}
          style={StyleSheet.absoluteFillObject}
          androidLayerType="hardware"
          allowsInlineMediaPlayback
        />
      ) : loadError ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={Colors.accent} size="small" />
        </View>
      )}

      {/* GLB injection failed after the WebView itself loaded fine — distinct
          from loadError above, and needs to sit on top of the (blank) WebView
          rather than replace it. Manual retry re-runs the same load path. */}
      {glbError && (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Couldn't load the 3D model.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.75}>
            <Ionicons name="refresh" size={14} color={Colors.onAccent} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {viewerHtml && !modelReady && !glbError && <View style={styles.loading} pointerEvents="none"><ActivityIndicator color={Colors.accent} size="small" /></View>}

      {/* Only real saved records are projected. No predefined editable dots. */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {pins.map(pin => {
          const position = zoneScreenPos[pin.id];
          if (!position?.visible) return null;
          return <TouchableOpacity key={pin.id}
            style={[styles.hotspot, { left: position.x + "%" as any, top: position.y + "%" as any }]}
            onPress={() => onDamagePinPress?.(pin.id)} accessibilityRole="button"
            accessibilityLabel={"Damage " + pin.number + (pin.approximate ? ", approximate panel" : ", saved point")}>
            <View style={[styles.numberPin, pin.approximate && styles.approximatePin, selectedDamageId === pin.id && styles.selectedPin]}>
              <Text style={styles.pinText}>{pin.number}</Text>
            </View>
          </TouchableOpacity>;
        })}
      </View>
    </View>
      <Text style={styles.instructions}>{onSurfaceTap ? "Drag to rotate. Tap the vehicle to mark damage." : "Drag to rotate. Tap a numbered mark for details."}</Text>
      {pins.some(pin => pin.approximate) && <Text style={styles.instructions}>Dashed marks indicate approximate panels, not exact damage locations.</Text>}
    </View>
  );
}

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
    gap: 12,
    backgroundColor: Colors.deepNearBlack,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.accent,
  },
  retryBtnText: {
    color: Colors.onAccent,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semiBold,
  },

  // Generic-model disclosure banner
  disclosureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    gap: 8,
    borderRadius: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha08,
  },
  disclosureText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    lineHeight: 15,
  },

  numberPin: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#dc2626", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  approximatePin: { borderStyle: "dashed" },
  selectedPin: { backgroundColor: "#7f1d1d" },
  pinText: { color: "#fff", fontFamily: FontFamily.bold, fontSize: 11 },
  instructions: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 6, lineHeight: 18 },
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
    borderColor: Colors.onAccent,
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
    color: Colors.onAccent,
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
    color: Colors.onAccentMuted,
    fontSize: FontSize.size10,
    fontFamily: FontFamily.regular,
  },
});
