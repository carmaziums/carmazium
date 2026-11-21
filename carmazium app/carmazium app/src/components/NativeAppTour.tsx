import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';
import { FontSize } from '../constants/typography';
import { navigationRef } from '../lib/navigationRef';
import {
  getNativeAppTourSteps, nativeTourStorageKey,
  subscribeNativeAppTourReplay, type NativeTourStep,
} from '../lib/nativeAppTour';

type TourResult = 'completed' | 'skipped';

/** A native overlay over REAL app screens, with one-time per-account acknowledgement. */
export const NativeAppTour: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore(s => s.user?.id);
  const role = useAuthStore(s => s.accountRole);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const hasCompletedOnboarding = useAuthStore(s => s.hasCompletedOnboarding);
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const steps = useMemo(() => getNativeAppTourSteps(role), [role]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const canShow = !!userId && isAuthenticated && hasCompletedOnboarding;

  // Existing as well as new accounts see the native introduction once. Persist
  // per account, not per device or website, to avoid accidentally hiding it.
  useEffect(() => {
    if (!canShow || !userId) {
      setVisible(false);
      void Speech.stop();
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      void AsyncStorage.getItem(nativeTourStorageKey(userId))
        .then(value => {
          if (active && value !== 'completed' && value !== 'skipped') {
            setStepIndex(0);
            setVisible(true);
          }
        })
        .catch(() => { /* If local storage fails, users can still replay manually. */ });
    }, 1800);
    return () => { active = false; clearTimeout(timer); };
  }, [canShow, userId]);

  // The permanent button lives in Account Settings > Personal details.
  useEffect(() => subscribeNativeAppTourReplay(() => {
    if (!canShow) return;
    setStepIndex(0);
    setVisible(true);
  }), [canShow]);

  const navigateToStep = useCallback((next: NativeTourStep) => {
    if (!next.destination || !navigationRef.isReady()) return;
    const destination = next.destination;
    if (destination.screen === 'Tabs' && 'tab' in destination) {
      navigationRef.navigate('Main', {
        screen: 'Tabs', params: { screen: destination.tab },
      });
    } else {
      navigationRef.navigate('Main', {
        screen: destination.screen,
        params: 'params' in destination ? destination.params : undefined,
      });
    }
  }, []);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length) return;
    setStepIndex(nextIndex);
    navigateToStep(steps[nextIndex]);
  }, [navigateToStep, steps]);

  const closeTour = useCallback((result: TourResult) => {
    setVisible(false);
    void Speech.stop();
    if (userId) {
      void AsyncStorage.setItem(nativeTourStorageKey(userId), result).catch(() => {
        // We deliberately never delete an existing record or reset the session.
      });
    }
  }, [userId]);

  useEffect(() => {
    void Speech.stop();
    if (!visible || !voiceEnabled || !step) return;
    try {
      Speech.speak(`${step.title}. ${step.description}`, {
        language: 'en-GB',
        rate: 0.94,
        pitch: 1,
      });
    } catch { /* Spoken guidance is optional. Text always works. */ }
    return () => { void Speech.stop(); };
  }, [visible, voiceEnabled, step]);

  if (!canShow || !step) return null;

  // High-contrast spotlight focuses on the currently displayed native screen,
  // leaving the page visible while the bottom sheet explains how to use it.
  const isWelcome = step.id === 'welcome';
  const spotlightTop = insets.top + (step.focus === 'bottom' ? Math.max(175, height * 0.51) : 78);
  const spotlightHeight = step.focus === 'bottom' ? 65 : Math.min(126, height * 0.22);
  const left = 16;
  const right = 16;
  const spotBottom = Math.min(height, spotlightTop + spotlightHeight);
  const spotlightWidth = Math.max(0, width - left - right);
  const shade = 'rgba(10, 18, 34, 0.66)';
  const nextIsFinal = stepIndex === steps.length - 1;

  return (
    <Modal
      visible={visible} animationType="fade" transparent
      statusBarTranslucent
      onRequestClose={() => closeTour('skipped')}
    >
      <View style={styles.root} accessibilityViewIsModal>
        {isWelcome ? (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: shade }]} />
        ) : (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={[styles.shade, { top: 0, height: spotlightTop, backgroundColor: shade }]} />
            <View style={[styles.shade, { top: spotlightTop, left: 0, width: left, height: spotlightHeight, backgroundColor: shade }]} />
            <View style={[styles.shade, { top: spotlightTop, right: 0, width: right, height: spotlightHeight, backgroundColor: shade }]} />
            <View style={[styles.shade, { top: spotBottom, bottom: 0, backgroundColor: shade }]} />
            <View style={{
              position: 'absolute', top: spotlightTop, left,
              width: spotlightWidth, height: spotlightHeight,
              borderRadius: 16, borderWidth: 3, borderColor: Colors.accent,
            }} />
          </View>
        )}
        <View style={[styles.sheetArea, isWelcome && styles.welcomeArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.sheet, { maxHeight: Math.max(218, height * 0.62) }]}>
            <View style={styles.topRow}>
              <View style={styles.progress}><Ionicons name="compass-outline" size={16} color={Colors.accent} />
                <Text style={styles.stepCount}>APP TOUR  {stepIndex + 1} / {steps.length}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip app tour"
                onPress={() => closeTour('skipped')} style={styles.skip}>
                <Text style={styles.skipText}>Skip tour</Text>
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
            </View>
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollContent}>
              <Text style={styles.title} accessibilityRole="header">{step.title}</Text>
              <Text style={styles.description}>{step.description}</Text>
              {!isWelcome && <Text style={styles.hint}>The relevant app page is shown behind this guide.</Text>}
            </ScrollView>
            <View style={styles.voiceRow}>
              <Ionicons name={voiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'} size={18} color={Colors.textPrimary} />
              <Text style={styles.voiceLabel}>Voice guidance</Text>
              <TouchableOpacity
                accessibilityRole="switch"
                accessibilityLabel="Voice guidance"
                accessibilityState={{ checked: voiceEnabled }}
                onPress={() => setVoiceEnabled(value => !value)}
                style={[styles.voiceToggle, voiceEnabled && styles.voiceToggleActive]}>
                <View style={[styles.voiceKnob, voiceEnabled && styles.voiceKnobActive]} />
              </TouchableOpacity>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button" accessibilityLabel="Previous tour step"
                disabled={stepIndex === 0}
                onPress={() => goTo(stepIndex - 1)}
                style={[styles.backButton, stepIndex === 0 && styles.disabled]}>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={nextIsFinal ? 'Finish app tour' : 'Next tour step'}
                onPress={() => nextIsFinal ? closeTour('completed') : goTo(stepIndex + 1)}
                style={styles.nextButton}>
                <Text style={styles.nextText}>{nextIsFinal ? 'Finish tour' : stepIndex === 0 ? 'Start tour' : 'Next'}</Text>
                <Ionicons name={nextIsFinal ? 'checkmark' : 'arrow-forward'} size={17} color={Colors.onAccent} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  shade: { position: 'absolute', left: 0, right: 0 },
  sheetArea: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12 },
  welcomeArea: { justifyContent: 'center' },
  sheet: {
    width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: Colors.bgCard,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepCount: { fontSize: FontSize.xs, letterSpacing: 1, fontWeight: '700', color: Colors.textSecondary },
  skip: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, minHeight: 44 },
  skipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  progressTrack: { height: 4, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden', marginTop: 2 },
  progressFill: { height: '100%', backgroundColor: Colors.accent },
  bodyScroll: { flexGrow: 0, marginTop: 12 },
  bodyScrollContent: { paddingBottom: 8 },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '800', marginBottom: 7 },
  description: { color: Colors.textSecondary, fontSize: FontSize.base, lineHeight: 22 },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm - 1, marginTop: 8 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  voiceLabel: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },
  voiceToggle: { width: 46, height: 27, borderRadius: 16, padding: 3, backgroundColor: Colors.border, justifyContent: 'center' },
  voiceToggleActive: { backgroundColor: Colors.accent },
  voiceKnob: { width: 21, height: 21, borderRadius: 12, backgroundColor: Colors.onAccent, alignSelf: 'flex-start' },
  voiceKnobActive: { alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  backButton: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, minHeight: 46, justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  backText: { fontSize: FontSize.base - 1, fontWeight: '700', color: Colors.textPrimary },
  nextButton: {
    borderRadius: 12, flex: 1, minHeight: 46, backgroundColor: Colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nextText: { color: Colors.onAccent, fontSize: FontSize.base, fontWeight: '800' },
});
