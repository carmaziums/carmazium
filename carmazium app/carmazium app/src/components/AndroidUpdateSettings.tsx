import React, { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import {
  canSelfUpdate,
  isGooglePlayDistribution,
  checkForUpdateStatus,
  currentVersionCode,
  downloadAndInstall,
  type AvailableUpdate,
} from '../lib/appUpdater';

/**
 * Original CarMazium Android APK only. This does not create an iPhone-only
 * screen or install a second app; it checks the same signed release advertised
 * on carmazium.com and opens Android's normal installation confirmation.
 */
export const AndroidUpdateSettings: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [available, setAvailable] = useState<AvailableUpdate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supported = canSelfUpdate();

  const check = async () => {
    if (!supported || checking || installing) return;
    setChecking(true);
    setMessage(null);
    try {
      const result = await checkForUpdateStatus();
      if (result.status === 'available') {
        setAvailable(result.update);
        setMessage(`Build ${result.update.versionCode} is available.`);
      } else {
        setAvailable(null);
        setMessage(result.status === 'up-to-date'
          ? `You're up to date (build ${result.versionCode}).`
          : result.status === 'error'
            ? result.message
            : 'Update checks are not available for this installation.');
      }
    } catch {
      setMessage('Unable to check for updates. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const install = async () => {
    if (!supported || !available || installing) return;
    setInstalling(true);
    setMessage(null);
    setProgress(0);
    try {
      await downloadAndInstall(available, setProgress);
      // Invoking the Android installer does not itself mean it was installed.
      setMessage('Android installer opened. Confirm Install to finish updating.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not download the update. Please try again.');
    } finally {
      setProgress(null);
      setInstalling(false);
    }
  };

  if (isGooglePlayDistribution()) return (
    <View style={styles.container} accessibilityLabel="Android app version and updates">
      <Text style={styles.title}>APP UPDATES</Text>
      <Text style={styles.body}>Installed CarMazium build {currentVersionCode()}. Updates are managed by Google Play.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Google Play"
        style={[styles.button, styles.checkButton]}
        onPress={() => { void Linking.openURL('https://play.google.com/store/apps/details?id=uk.carmazium.app')
          .catch(() => setMessage('Could not open Google Play. Please open the Play Store app to check for updates.')); }}>
        <Text style={styles.checkText}>Open Google Play</Text>
      </TouchableOpacity>
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{message}</Text>}
    </View>
  );
  if (!supported) return null;

  return (
    <View style={styles.container} accessibilityLabel="Android app version and updates">
      <Text style={styles.title}>APP UPDATES</Text>
      <Text style={styles.body}>
        Installed CarMazium build {currentVersionCode()}. Check for a newer signed release.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Check for updates"
          disabled={checking || installing} style={[styles.button, styles.checkButton]}
          onPress={() => { void check(); }}>
          {checking ? <ActivityIndicator size="small" color={Colors.textPrimary} /> : null}
          <Text style={styles.checkText}>{checking ? 'Checking…' : 'Check for updates'}</Text>
        </TouchableOpacity>
        {available && !checking && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Download and install update"
            disabled={installing} style={[styles.button, styles.installButton]}
            onPress={() => { void install(); }}>
            <Text style={styles.installText}>{installing ? 'Downloading…' : `Update to ${available.versionCode}`}</Text>
          </TouchableOpacity>
        )}
      </View>
      {progress !== null &&
        <Text style={styles.body} accessibilityLiveRegion="polite">
          Downloading signed APK… {Math.round(progress * 100)}%
        </Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{message}</Text>}
      <Text style={styles.note}>
        Android will ask you to confirm installation. Your existing app and account are retained.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 16, padding: 14, gap: 10, marginBottom: 14,
  },
  title: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.sm, letterSpacing: 0.5 },
  body: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, justifyContent: 'center',
    alignItems: 'center', flexDirection: 'row', gap: 8, flexGrow: 1 },
  checkButton: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  installButton: { backgroundColor: Colors.accent },
  checkText: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  installText: { color: Colors.onAccent, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  feedback: { color: Colors.textPrimary, fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  note: { color: Colors.textMuted, fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: 17 },
});
