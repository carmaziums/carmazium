import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from './Button';
import { AvailableUpdate, checkForUpdate, downloadAndInstall } from '../lib/appUpdater';
import { Colors } from '../constants/colors';
import { Elevation, Radius } from '../constants/spacing';
import { FontFamily, FontSize } from '../constants/typography';

const CHECK_EVERY_MS = 6 * 60 * 60_000;

/**
 * "New version available" prompt. Checks on launch and when the app comes
 * back to the foreground (at most every 6 hours). Update downloads the new
 * version in the app and opens Android's installer.
 */
export const AppUpdatePrompt: React.FC = () => {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [dismissedCode, setDismissedCode] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    lastCheck.current = Date.now();
    const found = await checkForUpdate();
    if (found) setUpdate(found);
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void check(); });
    return () => sub.remove();
  }, [check]);

  const start = async () => {
    if (!update) return;
    setError(null);
    setProgress(0);
    try {
      await downloadAndInstall(update, setProgress);
      setProgress(null);
    } catch (err: any) {
      setProgress(null);
      setError(err?.message || 'Could not download the update. Please try again.');
    }
  };

  const visible = !!update && dismissedCode !== update.versionCode;
  const downloading = progress != null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !downloading && update && setDismissedCode(update.versionCode)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}><Ionicons name="arrow-down-circle" size={34} color={Colors.accent} /></View>
          <Text style={styles.title} accessibilityRole="header">New version available</Text>
          <Text style={styles.body}>
            A new version of CarMazium is ready with the latest fixes and features. Update now to keep everything working smoothly.
          </Text>
          {downloading && (
            <View style={styles.progressWrap} accessibilityLabel={`Downloading ${Math.round((progress ?? 0) * 100)} percent`}>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]} /></View>
              <Text style={styles.progressText}>{progress === 1 ? 'Opening installer…' : `Downloading… ${Math.round((progress ?? 0) * 100)}%`}</Text>
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={downloading ? 'Updating…' : 'Update now'} variant="primary" size="lg" fullWidth onPress={start} disabled={downloading} loading={downloading && progress !== 1} />
          {!downloading && (
            <Button label="Later" variant="ghost" size="sm" fullWidth onPress={() => update && setDismissedCode(update.versionCode)} style={{ marginTop: 8 }} />
          )}
          <Text style={styles.hint}>Android will ask you to tap Install to finish. Your account and data stay as they are.</Text>
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
  progressFill: { height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  progressText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  error: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center', marginBottom: 10 },
  hint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
