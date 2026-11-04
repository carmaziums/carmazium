import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from '../Button';
import { openSignIn } from '../SignInRequired';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { Elevation, Radius } from '../../constants/spacing';
import { FontFamily, FontSize } from '../../constants/typography';

/**
 * "Rate this seller" — mirrors web's components/profile/ProfileReviewForm.
 * Posts to POST /profiles/:userId/reviews; the backend accepts it only after a
 * completed CarMazium sale, handover, delivery or service job between the two
 * accounts, and recalculates the seller's rating and reliability score.
 */
export const ProfileReviewForm: React.FC<{ profileUserId: string; onSaved?: () => void }> = ({ profileUserId, onSaved }) => {
  const navigation = useNavigation<any>();
  const myId = useAuthStore((s) => s.user?.id ?? null);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (myId && myId === profileUserId) return null;

  if (!signedIn) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Want to leave a review?</Text>
        <Text style={styles.note}>
          Sign in first. Reviews are accepted only after a completed CarMazium transaction or service interaction.
        </Text>
        <Button
          label="Sign in to review"
          size="sm"
          onPress={() => openSignIn(navigation, 'Login', { name: 'SellerProfile', params: { sellerId: profileUserId } })}
        />
      </View>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient(`/profiles/${profileUserId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      setMessage('Your review has been saved.');
      setComment('');
      onSaved?.();
    } catch (err: any) {
      setError(err?.message || 'Could not save your review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Rate this seller</Text>
      <Text style={styles.note}>
        Only people with a completed CarMazium vehicle transaction, handover, delivery or service job can submit a review.
      </Text>
      <View style={styles.stars} accessibilityLabel={`${rating} star rating`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
            accessibilityState={{ selected: star <= rating }}
          >
            <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={28} color={star <= rating ? Colors.warning : Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={1000}
        placeholder="Share your experience (optional)"
        placeholderTextColor={Colors.inputPlaceholder}
        textAlignVertical="top"
      />
      <Button label={busy ? 'Saving…' : 'Save review'} size="sm" onPress={submit} disabled={busy} loading={busy} />
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20, marginTop: 16, padding: 18, gap: 12,
    backgroundColor: Colors.bgCard, borderRadius: Radius.card,
    borderWidth: 1, borderColor: Colors.border, ...Elevation.card,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textPrimary },
  note: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 19 },
  stars: { flexDirection: 'row', gap: 6 },
  input: {
    minHeight: 84, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.inputBg, color: Colors.textPrimary, padding: 12,
    fontFamily: FontFamily.regular, fontSize: FontSize.base,
  },
  ok: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.success },
  err: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.error },
});
