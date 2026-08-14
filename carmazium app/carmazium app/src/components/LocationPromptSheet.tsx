import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/spacing';
import { FontFamily, FontSize } from '../constants/typography';

/**
 * One-time prompt for accounts missing location / postcode.
 *
 * Both became mandatory on the backend in 53c5acca, but accounts created
 * before that never went through a step that collects them, and mobile's
 * PostSignupOnboarding only runs for fresh signups — so those users had no
 * path to ever supply the fields. Web solved this with LocationPromptModal
 * (src/components/features/LocationPromptModal.tsx); this is its mobile
 * counterpart.
 *
 * Deliberately dismissible, and asked at most once per app session. It is a
 * data-quality nudge, not a gate — blocking an existing user out of the app
 * over a field they were never asked for would be a far worse outcome than a
 * missing postcode.
 */

/**
 * Module-scope rather than persisted storage, matching web's use of
 * sessionStorage: "once per session" should reset when the app is reopened, so
 * a user who dismisses it isn't asked again this run but isn't lost forever
 * either. Persisting it would silently retire the prompt after one dismissal.
 */
let dismissedThisSession = false;

export const LocationPromptSheet: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [dismissed, setDismissed] = useState(dismissedThisSession);
  const [location, setLocation] = useState('');
  const [postcode, setPostcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const missingInfo = !!user && (!user.location?.trim() || !user.postcode?.trim());

  // Not shown mid-onboarding: that flow already collects location, so prompting
  // over the top of it would ask the same question twice.
  const show = isAuthenticated && hasCompletedOnboarding && missingInfo && !dismissed;

  const handleDismiss = () => {
    dismissedThisSession = true;
    setDismissed(true);
  };

  const handleSave = async () => {
    const trimmedLocation = location.trim();
    const trimmedPostcode = postcode.trim();
    if (!trimmedLocation || !trimmedPostcode) {
      setError('Please fill in both fields.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ location: trimmedLocation, postcode: trimmedPostcode }),
      });
      // Update the store directly rather than refetching the profile — the two
      // fields just saved are the only ones that changed, and a full refetch
      // here would race the screen underneath.
      updateUser({ location: trimmedLocation, postcode: trimmedPostcode });
      handleDismiss();
    } catch (err: any) {
      setError(err?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <BottomSheet visible onClose={handleDismiss} title="Complete your profile" avoidKeyboard>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="location-outline" size={20} color={Colors.accent} />
        </View>

        <Text style={styles.blurb}>
          Add your town and postcode so we can show you distance to vehicles and
          accurate delivery estimates.
        </Text>

        <Text style={styles.label}>Town or city</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Manchester"
          placeholderTextColor={Colors.inputPlaceholder}
          autoCorrect={false}
          editable={!saving}
        />

        <Text style={styles.label}>Postcode</Text>
        <TextInput
          style={styles.input}
          value={postcode}
          onChangeText={setPostcode}
          placeholder="e.g. M1 2AB"
          placeholderTextColor={Colors.inputPlaceholder}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!saving}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDismiss}
          disabled={saving}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.laterText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: {
    gap: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  blurb: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.inline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  error: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.error,
  },
  saveBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  laterText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
