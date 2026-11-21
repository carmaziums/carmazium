import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';
import { useGuidedTourStore } from '../store/guidedTourStore';
import { getGuidedWebsiteSteps } from '../lib/guidedTourContent';
import { nativeTourDestination } from '../lib/nativeTourRoutes';
import { navigationRef } from '../lib/navigationRef';
import { apiClient } from '../lib/apiClient';
import { NativeTourVoice } from './NativeTourVoice';

const supported = ['buyer', 'seller', 'dealer', 'contractor'];
const safeRoutes = ['Home', 'DealerHome', 'Profile', 'UnifiedDashboard', 'BuyerDashboard', 'SellerDashboard', 'Search', 'PartnerDashboard', 'ProviderOverview'];
type FinishAction = 'tour_skipped' | 'tour_completed';

function TourButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.4 }]}>
    <Text style={styles.buttonText}>{title}</Text>
  </TouchableOpacity>;
}

export function NativeGuidedTour() {
  const { user, accountRole, isAuthenticated, hasCompletedOnboarding } = useAuthStore();
  const { openFor, replay, close } = useGuidedTourStore();
  const eligible = isAuthenticated && hasCompletedOnboarding && supported.includes(accountRole);
  const open = eligible && !!user && openFor === user.id;
  const seen = useRef(new Set<string>());
  const [index, setIndex] = useState(0);
  const [topics, setTopics] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [failed, setFailed] = useState<{ userId: string; action: FinishAction } | null>(null);
  const [saving, setSaving] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const steps = useMemo(() => getGuidedWebsiteSteps({
    id: user?.id ?? '', role: accountRole.toUpperCase(),
    dealerProfile: accountRole === 'dealer' && !user?.isDealerStaff ? {} : undefined,
  }), [user?.id, user?.isDealerStaff, accountRole]);
  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => {
    const update = () => setRouteName(navigationRef.getCurrentRoute()?.name ?? '');
    const unsubscribe = navigationRef.addListener('state', update);
    const timer = setTimeout(update, 300);
    return () => { clearTimeout(timer); unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!eligible || !user || !safeRoutes.includes(routeName) || seen.current.has(user.id)) return;
    const id = user.id;
    seen.current.add(id);
    let active = true;
    void apiClient<{ data: { id: string; preferences?: { websiteIntroductionV2?: { version?: number; status?: string } } } }>('/users/me')
      .then(response => {
        const auth = useAuthStore.getState();
        if (!active || auth.user?.id !== id || !auth.isAuthenticated || response.data?.id !== id) return;
        const saved = response.data.preferences?.websiteIntroductionV2;
        if (saved?.version === 2 && ['skipped', 'completed'].includes(saved.status ?? '')) return;
        if (safeRoutes.includes(navigationRef.getCurrentRoute()?.name ?? '')) replay(id);
      }).catch(() => { /* Replay stays available; a failed read must not interrupt the user. */ });
    return () => { active = false; };
  }, [eligible, user?.id, routeName, replay]);
  useEffect(() => {
    if (!open) return;
    setIndex(0); setTopics(false); setUnavailable(false);
    if (user) seen.current.add(user.id);
  }, [open, user?.id]);
  useEffect(() => {
    if (!isAuthenticated) close();
  }, [isAuthenticated, close]);

  const go = (next: number) => {
    if (!user || useAuthStore.getState().user?.id !== user.id) return;
    setIndex(next); setTopics(false); scroll.current?.scrollTo({ y: 0, animated: false });
    const destination = nativeTourDestination(steps[next]?.href);
    setUnavailable(!!steps[next]?.href && !destination);
    if (destination && navigationRef.isReady()) navigationRef.navigate('Main', destination);
  };
  const persist = async (action: FinishAction, userId: string) => {
    if (useAuthStore.getState().user?.id !== userId) return;
    setSaving(true);
    try {
      await apiClient('/users/me/introduction', { method: 'PATCH', body: JSON.stringify({ action, version: 2 }) });
      if (useAuthStore.getState().user?.id === userId) setFailed(null);
    } catch {
      if (useAuthStore.getState().user?.id === userId) setFailed({ userId, action });
    } finally { setSaving(false); }
  };
  const finish = (action: FinishAction) => {
    close();
    if (!user) return;
    void persist(action, user.id);
    if (action === 'tour_skipped') Alert.alert('Tour skipped', 'Replay it whenever you like in Account Settings → Personal details → Replay website tour.');
  };
  if (!open) return failed && failed.userId === user?.id ? <View style={styles.failure}>
    <Text style={styles.description}>We could not save your tour choice. It may appear again when you sign in.</Text>
    <TourButton title={saving ? 'Saving…' : 'Retry saving'} disabled={saving} onPress={() => { void persist(failed.action, failed.userId); }} />
    <TourButton title="Dismiss message" onPress={() => setFailed(null)} />
  </View> : null;
  return <Modal transparent animationType="fade" visible onRequestClose={() => finish('tour_skipped')}>
    <View style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      {/* The current native page stays visible. The modal prevents tour taps
          from operating forms, bidding controls or payment buttons beneath it. */}
      <View accessible={false} style={styles.pageOutline} />
      <View accessibilityViewIsModal style={[styles.panel, { maxHeight: height * 0.65 }]}>
        <View style={styles.row}>
          <Text style={styles.progress}>Website tour · {index + 1} of {steps.length}</Text>
          <TourButton title="Skip tour" onPress={() => finish('tour_skipped')} />
        </View>
        <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 8 }}>
          <Text accessibilityRole="header" style={styles.heading}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
          {unavailable && <Text style={styles.description}>This page is not available in the app yet. You can continue to the next topic.</Text>}
          <NativeTourVoice text={`${step.title}. ${step.description}`} />
          <TourButton title="Jump to a topic" onPress={() => setTopics(value => !value)} />
          {topics && steps.map((item, position) => <TourButton key={item.id} title={`${position + 1}. ${item.title}`} onPress={() => go(position)} />)}
        </ScrollView>
        <View style={styles.row}>
          <TourButton title="Back" disabled={index === 0} onPress={() => go(index - 1)} />
          <TourButton title={index === 0 ? 'Start tour' : index === steps.length - 1 ? 'Finish tour' : 'Next'} onPress={() => index === steps.length - 1 ? finish('tour_completed') : go(index + 1)} />
        </View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, paddingHorizontal: 12, gap: 12, backgroundColor: 'rgba(0,0,0,0.55)' },
  pageOutline: { flex: 1, borderWidth: 3, borderColor: Colors.accent, borderRadius: 14 },
  panel: { borderRadius: 18, padding: 16, backgroundColor: Colors.bgPrimary, borderWidth: 1, borderColor: Colors.glassBorder },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  progress: { fontSize: 14, color: Colors.textSecondary },
  heading: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  description: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: Colors.accent },
  failure: { position: 'absolute', bottom: 90, left: 16, right: 16, padding: 16, backgroundColor: Colors.bgPrimary, borderWidth: 1, borderColor: Colors.glassBorder },
});
