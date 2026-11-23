import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from './Button';
import { AvailableUpdate, checkForUpdateStatus, downloadAndInstall } from '../lib/appUpdater';
import { Colors } from '../constants/colors';
import { Elevation, Radius } from '../constants/spacing';
import { FontFamily, FontSize } from '../constants/typography';

const CHECK_EVERY_MS = 15 * 60_000;
const RETRY_AFTER_FAILURE_MS = 60_000;
const REMIND_AFTER_MS = 24 * 60 * 60_000;
const FOREGROUND_POLL_MS = 60_000;
const SNOOZE_KEY = 'carmazium:app-update:later:v1';

type Candidate =
  | { kind: 'apk'; key: string; release: AvailableUpdate }
  | { kind: 'ota'; key: string };
type Snooze = { key: string; until: number };

export function isUpdateSnoozed(candidateKey: string, snooze: Snooze | null, now: number): boolean {
  return !!snooze && snooze.key === candidateKey && Number.isFinite(snooze.until) && now < snooze.until;
}

function readSnooze(raw: string | null): Snooze | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && 'key' in value && 'until' in value &&
        typeof value.key === 'string' && typeof value.until === 'number') {
      return { key: value.key, until: value.until };
    }
  } catch { /* corrupt saved preference must not block an update */ }
  return null;
}

/**
 * Non-forcing update notice inside the original CarMazium app.
 * Scan on launch, on foreground resume and periodically WHILE OPEN. A user
 * decides whether to install. This is not an OS background-update service.
 *
 * Native Android APK upgrades use the approved carmazium.com signed release;
 * compatible EAS JS/asset updates are also opt-in (Android/iOS) when enabled.
 */
export const AppUpdatePrompt: React.FC = () => {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [snooze, setSnooze] = useState<Snooze | null>(null);
  const [snoozeReady, setSnoozeReady] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCheck = useRef(0);
  const checkInFlight = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    if (AppState.currentState !== 'active' || busy.current || checkInFlight.current ||
        Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    checkInFlight.current = true;
    lastCheck.current = Date.now();
    let failed = false;
    try {
      const result = await checkForUpdateStatus();
      if (!mounted.current) return;
      if (result.status === 'available') {
        const release = result.update;
        setCandidate({ kind: 'apk', key: `apk:${release.versionCode}`, release });
        return; // Never hide a newer signed APK behind a compatible OTA.
      }
      if (result.status === 'error') failed = true;
      // EAS OTA must be runtime-compatible, enabled in the signed binary and
      // optional. App.tsx deliberately does not fetch/reload in the background.
      if (Updates.isEnabled) {
        try {
          const available = await Updates.checkForUpdateAsync();
          if (!mounted.current) return;
          if (available.isAvailable) {
            setCandidate({ kind: 'ota', key: `ota:${available.manifest?.id ?? 'available'}` });
            return;
          }
        } catch { failed = true; }
      }
      if (!failed && mounted.current) setCandidate(null);
    } catch {
      failed = true;
    } finally {
      if (failed) lastCheck.current = Date.now() - CHECK_EVERY_MS + RETRY_AFTER_FAILURE_MS;
      checkInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void AsyncStorage.getItem(SNOOZE_KEY)
      .then(raw => { if (mounted.current) setSnooze(readSnooze(raw)); })
      .catch(() => { /* keep optional prompt available if storage is blocked */ })
      .finally(() => { if (mounted.current) setSnoozeReady(true); });
    void check(); // Launch.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void check(); // Resume.
    });
    const timer = setInterval(() => { void check(); }, FOREGROUND_POLL_MS); // Still open.
    return () => {
      mounted.current = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [check]);

  const dismiss = async () => {
    if (!candidate || busy.current) return;
    const next = { key: candidate.key, until: Date.now() + REMIND_AFTER_MS };
    setSnooze(next);
    try { await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(next)); }
    catch { /* a storage error must not force installation or lock the user in */ }
  };

  const start = async () => {
    if (!candidate || busy.current) return;
    busy.current = true;
    setError(null);
    setProgress(0);
    try {
      if (candidate.kind === 'apk') {
        await downloadAndInstall(candidate.release, value => {
          if (mounted.current) setProgress(value);
        });
        // Opening Android's installer is NOT proof the user accepted/installled.
        await dismissAfterInstaller(candidate.key);
      } else {
        if (!Updates.isEnabled) throw new Error('Compatible updates are not enabled in this build.');
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync(); // Only after an explicit Update now tap.
      }
    } catch (err: unknown) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Could not start the update. Please try again.');
      }
    } finally {
      busy.current = false;
      if (mounted.current) setProgress(null);
    }
  };

  const dismissAfterInstaller = async (key: string) => {
    // If the user cancels the system installer, show another reminder later,
    // not immediately as soon as the app returns to the foreground.
    const next = { key, until: Date.now() + 60 * 60_000 };
    if (mounted.current) setSnooze(next);
    try { await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(next)); } catch { /* best effort */ }
  };

  const visible = !!candidate && snoozeReady &&
    !isUpdateSnoozed(candidate.key, snooze, Date.now());
  const downloading = progress != null;
  const isApk = candidate?.kind === 'apk';

  return (
    <Modal visible={visible} transparent animationType="fade"
      onRequestClose={() => { if (!downloading) void dismiss(); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}><Ionicons name="arrow-down-circle" size={34} color={Colors.accent} /></View>
          <Text style={styles.title} accessibilityRole="header">New version available</Text>
          <Text style={styles.body}>
            {candidate?.kind === 'apk'
              ? `CarMazium build ${candidate.release.versionCode} is available with the latest fixes and features. Would you like to update?`
              : 'Compatible CarMazium improvements are available. Would you like to apply them now?'}
          </Text>
          {downloading && (
            <View style={styles.progressWrap} accessibilityLabel={`Downloading ${Math.round((progress ?? 0) * 100)} percent`}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {candidate?.kind === 'ota'
                  ? 'Preparing the compatible update…'
                  : progress === 1 ? 'Opening installer…' : `Downloading… ${Math.round((progress ?? 0) * 100)}%`}
              </Text>
            </View>
          )}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Button label={downloading ? 'Updating…' : 'Update now'} variant="primary" size="lg"
            fullWidth onPress={() => { void start(); }} disabled={downloading}
            loading={downloading && progress !== 1} />
          {!downloading && (
            <Button label="Later" variant="ghost" size="sm" fullWidth
              onPress={() => { void dismiss(); }} style={{ marginTop: 8 }} />
          )}
          <Text style={styles.hint}>
            {isApk
              ? 'Android will ask you to confirm Install. Your account and data stay as they are.'
              : 'If you choose Update now, CarMazium downloads the improvements and restarts the app.'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.blackAlpha75, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 420, alignItems: 'center', padding: 24, borderRadius: Radius.card,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, ...Elevation.cardHi,
  },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentAlpha05, marginBottom: 14 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.textPrimary, textAlign: 'center' },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 8, marginBottom: 18 },
  progressWrap: { width: '100%', marginBottom: 14 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Colors.accent },
  progressText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  error: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center', marginBottom: 10 },
  hint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
