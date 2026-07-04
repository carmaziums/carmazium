import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { createChatRoom } from '../../lib/chatApi';
import { haptics } from '../../lib/haptics';

type ContactPref = 'CHAT' | 'PHONE' | 'EMAIL';

export interface EnquireModalProps {
  visible: boolean;
  onClose: () => void;
  /** The listing being enquired about. */
  listing: {
    id: string;
    title?: string;
    make?: string;
    model?: string;
    year?: number;
  };
  /** Seller user id — required to create the chat room. */
  sellerId: string | undefined;
  /**
   * Called after a chat room is created + first message sent so the caller
   * can navigate into it. Receives the new/existing room id.
   */
  onSent: (chatRoomId: string) => void;
}

const CONTACT_OPTIONS: { value: ContactPref; label: string; icon: any }[] = [
  { value: 'CHAT', label: 'In-app chat', icon: 'chatbubble-ellipses-outline' },
  { value: 'PHONE', label: 'Phone call', icon: 'call-outline' },
  { value: 'EMAIL', label: 'Email', icon: 'mail-outline' },
];

function fmtDate(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Structured enquiry form shown before the buyer lands in a plain chat.
 * Mirrors the /vehicle/[id] modal on web — a prefilled message with the
 * vehicle title, a preferred-contact radio, and an optional test-drive
 * date. On submit we create (or find) the chat room, send the composed
 * message, and hand the room id back to the caller so it can navigate.
 * A "Skip the form" link at the bottom opens the chat directly for
 * buyers who just want to type freely.
 */
export const EnquireModal: React.FC<EnquireModalProps> = ({
  visible,
  onClose,
  listing,
  sellerId,
  onSent,
}) => {
  const insets = useSafeAreaInsets();

  const prefill =
    `Hi — I'm interested in the ${listing.title ?? [listing.year, listing.make, listing.model].filter(Boolean).join(' ') ?? 'listing'}. ` +
    `Could you tell me a bit more about it and let me know when I could see it?`;

  const [message, setMessage] = useState(prefill);
  const [contact, setContact] = useState<ContactPref>('CHAT');
  const [testDriveDate, setTestDriveDate] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-prefill when the listing (and therefore the modal) changes.
  useEffect(() => {
    if (visible) {
      setMessage(prefill);
      setContact('CHAT');
      setTestDriveDate(null);
      setPickerVisible(false);
      setPickerMode('date');
      setError(null);
    }
    // Only re-run when we open the modal for a new listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, listing.id]);

  const contactLabel =
    CONTACT_OPTIONS.find(o => o.value === contact)?.label ?? 'In-app chat';

  const composeFullMessage = (): string => {
    const parts = [message.trim()];
    parts.push(`\n\nPreferred contact: ${contactLabel}.`);
    if (testDriveDate) {
      parts.push(`Would love a test drive around ${fmtDate(testDriveDate)} if possible.`);
    }
    return parts.join(' ');
  };

  const openRoom = async (composedText?: string) => {
    if (!sellerId) {
      setError('Seller information is not available for this listing.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const room = await createChatRoom(sellerId, listing.id);
      if (composedText && composedText.trim()) {
        try {
          await apiClient(`/chat/rooms/${room.id}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: composedText }),
          });
        } catch (msgErr: any) {
          // Message send failed but the room exists — surface a soft warning
          // and still hand back so the buyer can retry inside the chat.
          setError(
            msgErr?.message ??
              'Room opened but we could not send the first message. Try re-sending inside the chat.',
          );
        }
      }
      haptics.success();
      onSent(room.id);
    } catch (err: any) {
      setError(err?.message ?? 'Could not open chat. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!message.trim()) {
      setError('Please add a short message.');
      return;
    }
    openRoom(composeFullMessage());
  };

  const handleSkip = () => {
    openRoom(); // No prefilled message
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setPickerVisible(false);
      return;
    }
    if (selected) setTestDriveDate(selected);
    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setPickerMode('time');
        setPickerVisible(true);
      } else {
        setPickerVisible(false);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <Text style={styles.title}>Enquire about this vehicle</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle} numberOfLines={2}>
              {listing.title ??
                [listing.year, listing.make, listing.model].filter(Boolean).join(' ')}
            </Text>

            {/* Message */}
            <Text style={styles.fieldLabel}>YOUR MESSAGE</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={v => {
                setMessage(v);
                if (error) setError(null);
              }}
              multiline
              placeholder="What would you like to ask the seller?"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.accent}
              textAlignVertical="top"
            />

            {/* Contact preference */}
            <Text style={styles.fieldLabel}>PREFERRED CONTACT</Text>
            <View style={styles.contactRow}>
              {CONTACT_OPTIONS.map(opt => {
                const selected = contact === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.contactOption, selected && styles.contactOptionSelected]}
                    onPress={() => setContact(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={selected ? Colors.accent : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.contactOptionText,
                        selected && { color: Colors.accent },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Test drive date */}
            <Text style={styles.fieldLabel}>TEST DRIVE (optional)</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              activeOpacity={0.8}
              onPress={() => {
                setPickerMode('date');
                setPickerVisible(true);
              }}
            >
              <Ionicons name="calendar-outline" size={14} color="#60A5FA" />
              <Text style={styles.dateBtnText}>
                {testDriveDate ? fmtDate(testDriveDate) : 'Pick a date & time'}
              </Text>
              {testDriveDate && (
                <TouchableOpacity
                  onPress={() => setTestDriveDate(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {(Platform.OS === 'ios' || pickerVisible) && (
              <DateTimePicker
                value={testDriveDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000)}
                mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={onDateChange}
                themeVariant="dark"
                style={Platform.OS === 'ios' ? styles.iosDatePicker : undefined}
              />
            )}

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={12} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Actions */}
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Send enquiry</Text>
                </>
              )}
            </TouchableOpacity>

            {/* "Skip form" opens chat with no prefilled message */}
            <TouchableOpacity
              onPress={handleSkip}
              disabled={submitting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.skipRow}
            >
              <Text style={styles.skipText}>Skip form &amp; open chat</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: '#101015',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 22,
    paddingTop: 12,
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: Colors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
  },
  messageInput: {
    minHeight: 96,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  contactRow: {
    gap: 8,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  contactOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(220,31,38,0.08)',
  },
  contactOptionText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateBtnText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#60A5FA',
  },
  iosDatePicker: {
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.error,
    lineHeight: 17,
  },
  primaryBtn: {
    marginTop: 18,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  skipRow: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
