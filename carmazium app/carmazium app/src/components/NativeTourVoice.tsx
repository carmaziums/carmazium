import React, { useEffect, useState } from 'react';
import { AppState, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Crypto from 'expo-crypto';
import { getAccessToken } from '../lib/supabase';
import { Colors } from '../constants/colors';

/** The same approved, hashed public narration as the website. No microphone. */
export function NativeTourVoice({ text }: { text: string }) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setError(false);
    const timeout = setTimeout(() => {
      if (active && !player.isLoaded) { player.pause(); setError(true); }
    }, 60000);
    void (async () => {
      const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
      const token = await getAccessToken();
      if (!active) return;
      if (!token) throw Error('No session');
      const base = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';
      player.replace({ uri: `${base}/ai/tour-narration/${key}`, headers: { Authorization: `Bearer ${token}` } });
      player.play();
    })().catch(() => { if (active) setError(true); });
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') player.pause(); });
    return () => { active = false; clearTimeout(timeout); listener.remove(); player.pause(); player.replace(null); };
  }, [enabled, text, retry, player]);
  return <View style={{ gap: 8, marginVertical: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>Voice guidance (optional)</Text>
      <Switch accessibilityLabel="Voice guidance" value={enabled} onValueChange={setEnabled} />
    </View>
    {enabled && <>
      <Text accessibilityLiveRegion="polite" style={{ color: Colors.textSecondary, fontSize: 14 }}>
        {error ? 'Audio could not start. You can still follow the text.' : status.playing ? 'Playing voice guidance.' : status.isLoaded ? 'Natural British-English AI narration.' : 'Preparing voice guidance…'}
      </Text>
      <TouchableOpacity accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => {
        if (error) { setRetry(value => value + 1); return; }
        if (status.playing) player.pause();
        else { if (status.didJustFinish) void player.seekTo(0); player.play(); }
      }}>
        <Text style={{ color: Colors.accent, fontSize: 16, fontWeight: '700' }}>{error ? 'Try voice again' : status.playing ? 'Pause voice' : 'Play voice'}</Text>
      </TouchableOpacity>
    </>}
  </View>;
}
