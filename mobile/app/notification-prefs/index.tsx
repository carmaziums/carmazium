import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  type NotificationPreferences,
  DEFAULT_PREFS,
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/lib/notifications';

// ─── Toggle Row ───────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label:       string;
  description: string;
  value:       boolean;
  onToggle:    (val: boolean) => void;
}

function ToggleRow({ label, description, value, onToggle }: ToggleRowProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/5">
      <View className="flex-1 pr-4">
        <Text className="text-white font-semibold text-sm">{label}</Text>
        <Text className="text-white/50 text-xs mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#2a2d36', true: '#ff0037' }}
        thumbColor={value ? '#ffffff' : '#6b7280'}
        ios_backgroundColor="#2a2d36"
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationPrefsScreen() {
  const router = useRouter();
  const [prefs,   setPrefs]   = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  // Inline time editor state — cross-platform (no Alert.prompt which is iOS-only)
  const [editingField, setEditingField] = useState<'quietStart' | 'quietEnd' | null>(null);
  const [editValue,    setEditValue]    = useState('');

  useEffect(() => {
    getNotificationPreferences().then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean | string) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    await saveNotificationPreferences({ [key]: value });
  };

  const handleTimePress = (field: 'quietStart' | 'quietEnd') => {
    setEditingField(field);
    setEditValue(prefs[field] as string);
  };

  const commitTimeEdit = async () => {
    if (!editingField) return;
    if (!editValue.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      Alert.alert('Invalid time', 'Enter time as HH:MM (e.g. 22:00)');
      return;
    }
    await handleToggle(editingField, editValue);
    setEditingField(null);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#0a0d14] items-center justify-center">
        <ActivityIndicator color="#ff0037" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0a0d14]">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Text className="text-white/60 text-base">←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">Notification Preferences</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category Toggles */}
        <View className="mt-2">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-widest px-4 pb-2">
            Notification Types
          </Text>
          <View className="bg-white/[0.03] rounded-xl mx-4 overflow-hidden">
            <ToggleRow
              label="Auction Bids"
              description="Outbid alerts and auction results"
              value={prefs.bids}
              onToggle={(v) => handleToggle('bids', v)}
            />
            <ToggleRow
              label="Offers"
              description="New offers, counter-offers, and acceptances"
              value={prefs.offers}
              onToggle={(v) => handleToggle('offers', v)}
            />
            <ToggleRow
              label="Messages"
              description="New chat messages from buyers and sellers"
              value={prefs.messages}
              onToggle={(v) => handleToggle('messages', v)}
            />
            <ToggleRow
              label="System"
              description="KYC updates, account alerts, and announcements"
              value={prefs.system}
              onToggle={(v) => handleToggle('system', v)}
            />
          </View>
        </View>

        {/* Quiet Hours */}
        <View className="mt-6 mb-10">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-widest px-4 pb-2">
            Quiet Hours
          </Text>
          <View className="bg-white/[0.03] rounded-xl mx-4 overflow-hidden">
            <ToggleRow
              label="Enable Quiet Hours"
              description="Suppress notification banners during set hours"
              value={prefs.quietHoursEnabled}
              onToggle={(v) => handleToggle('quietHoursEnabled', v)}
            />

            {/* Start time */}
            <View className={`px-4 py-4 border-b border-white/5 ${!prefs.quietHoursEnabled ? 'opacity-40' : ''}`}>
              <View className="flex-row items-center justify-between">
                <Text className="text-white/70 text-sm">Start time</Text>
                {editingField === 'quietStart' ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      value={editValue}
                      onChangeText={setEditValue}
                      placeholder="HH:MM"
                      placeholderTextColor="#6b7280"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      autoFocus
                      onSubmitEditing={commitTimeEdit}
                      className="text-white text-sm border border-white/20 rounded px-2 py-1 w-16 text-center"
                    />
                    <TouchableOpacity onPress={commitTimeEdit} className="px-2 py-1">
                      <Text className="text-[#ff0037] text-sm font-medium">Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingField(null)} className="px-2 py-1">
                      <Text className="text-white/40 text-sm">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => prefs.quietHoursEnabled && handleTimePress('quietStart')}
                    disabled={!prefs.quietHoursEnabled}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white font-medium">{prefs.quietStart}</Text>
                      <Text className="text-white/30">›</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* End time */}
            <View className={`px-4 py-4 ${!prefs.quietHoursEnabled ? 'opacity-40' : ''}`}>
              <View className="flex-row items-center justify-between">
                <Text className="text-white/70 text-sm">End time</Text>
                {editingField === 'quietEnd' ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      value={editValue}
                      onChangeText={setEditValue}
                      placeholder="HH:MM"
                      placeholderTextColor="#6b7280"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      autoFocus
                      onSubmitEditing={commitTimeEdit}
                      className="text-white text-sm border border-white/20 rounded px-2 py-1 w-16 text-center"
                    />
                    <TouchableOpacity onPress={commitTimeEdit} className="px-2 py-1">
                      <Text className="text-[#ff0037] text-sm font-medium">Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingField(null)} className="px-2 py-1">
                      <Text className="text-white/40 text-sm">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => prefs.quietHoursEnabled && handleTimePress('quietEnd')}
                    disabled={!prefs.quietHoursEnabled}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white font-medium">{prefs.quietEnd}</Text>
                      <Text className="text-white/30">›</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          <Text className="text-white/30 text-xs px-4 mt-3">
            Quiet hours suppresses local banners only. Push notifications may still arrive when the app is backgrounded.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
