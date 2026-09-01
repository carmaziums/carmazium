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
 * One-time prompt for accounts missing a name or phone number (DASH-003).
 *
 * Web solves this with `ProfileCompletionGate` — a **non-dismissible** modal
 * covering the entire dashboard until `firstName`, `lastName` and (for
 * non-dealers) `phone` are set. Mobile deliberately does not copy that, and the
 * reason is already written down one file over: `LocationPromptSheet` faced the
 * same problem for location/postcode and chose a dismissible nudge, because
 * "blocking an existing user out of the app over a field they were never asked
 * for would be a far worse outcome than a missing postcode". The same reasoning
 * applies here with more force — an existing seller mid-sale should not be
 * locked out of their own dashboard over a phone number.
 *
 * The divergence from web is therefore intentional and owner-approved, not an
 * incomplete port. Recorded on DASH-003.
 *
 * Mobile's post-signup onboarding already collects the name for fresh signups,
 * so in practice this is aimed at accounts predating that flow, and at the phone
 * number, which nothing on mobile has ever asked for.
 */

/**
 * Module scope, matching `LocationPromptSheet`: "once per session" should reset
 * when the app is reopened. Persisting a dismissal would silently retire the
 * prompt forever after a single tap.
 */
let dismissedThisSession = false;

export const ProfileCompletionPromptSheet: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.accountRole);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [dismissed, setDismissed] = useState(dismissedThisSession);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const needsName = !!user && (!user.firstName?.trim() || !user.lastName?.trim());
  // Dealers are exempt from the phone requirement, matching web
  // (`ProfileCompletionGate.tsx:26`) — they supply a dealer phone separately
  // through the dealer profile.
  const needsPhone = !!user && role !== 'dealer' && !user.phone?.trim();

  // Defer to LocationPromptSheet when both would fire. Two bottom sheets
  // rendering at once stack badly, and the location prompt is the older,
  // already-shipping one — so this waits for the next session rather than
  // fighting it for the screen.
  const locationPromptWillShow = !!user && (!user.location?.trim() || !user.postcode?.trim());

  const show =
    isAuthenticated &&
    hasCompletedOnboarding &&
    (needsName || needsPhone) &&
    !locationPromptWillShow &&
    !dismissed;

  const handleDismiss = () => {
    dismissedThisSession = true;
    setDismissed(true);
  };

  const handleSave = async () => {
    const payload: Record<string, string> = {};
    if (needsName) {
      const f = firstName.trim();
      const l = lastName.trim();
      if (!f || !l) {
        setError('Please enter both your first and last name.');
        return;
      }
      payload.firstName = f;
      payload.lastName = l;
    }
    if (needsPhone) {
      const p = phone.trim();
      if (!p) {
        setError('Please enter a phone number.');
        return;
      }
      payload.phone = p;
    }

    setError('');
    setSaving(true);
    try {
      await apiClient('/users/me', { method: 'PATCH', body: JSON.stringify(payload) });
      // Update the store directly rather than refetching — only these fields
      // changed, and a full refetch here would race the screen underneath.
      updateUser(payload);
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
          <Ionicons name="person-outline" size={20} color={Colors.accent} />
        </View>

        <Text style={styles.blurb}>
          {needsPhone && needsName
            ? 'Add your name and a contact number so buyers and sellers know who they are dealing with.'
            : needsPhone
              ? 'Add a contact number so buyers and sellers can reach you about offers and handovers.'
              : 'Add your name so buyers and sellers know who they are dealing with.'}
        </Text>

        {needsName && (
          <>
            <Text style={styles.label}>First name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Alex"
              placeholderTextColor={Colors.inputPlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!saving}
            />

            <Text style={styles.label}>Last name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="e.g. Thompson"
              placeholderTextColor={Colors.inputPlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!saving}
            />
          </>
        )}

        {needsPhone && (
          <>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 07700 900000"
              placeholderTextColor={Colors.inputPlaceholder}
              keyboardType="phone-pad"
              autoCorrect={false}
              editable={!saving}
            />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.saveBtnText}>SAVE</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.laterBtn} onPress={handleDismiss} disabled={saving} activeOpacity={0.7}>
          <Text style={styles.laterText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  blurb: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.white,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.inline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  error: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.error,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.inline,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1.1,
  },
  laterBtn: { alignItems: 'center', marginTop: 14 },
  laterText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
  },
});
