import React, { useEffect, useRef, useState } from 'react';
import { AppState, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Crypto from 'expo-crypto';
import { getAccessToken } from '../lib/supabase';
import { Colors } from '../constants/colors';

/** The same approved, hashed public narration as the website. No microphone. */
export function NativeTourVoice({ text, ready = true }: { text: string; ready?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const pendingAutoPlay = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!ready) { pendingAutoPlay.current = false; if (player.isLoaded) player.pause(); return; }
    // Advancing the tour must never unload or release the native player.
    // Expo Audio owns the player's lifetime; only pause a loaded player.
    pendingAutoPlay.current = false;
    if (player.isLoaded) player.pause();
    let active = true;
    setError(false);
    const timeout = setTimeout(() => {
      if (active && !player.isLoaded) {
        active = false;
        pendingAutoPlay.current = false;
        setError(true);
      }
    }, 60000);

    void (async () => {
      const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
      const token = await getAccessToken();
      if (!active) return;
      if (!token) throw Error('No session');
      const base = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';
      player.replace({ uri: `${base}/ai/tour-narration/${key}`, headers: { Authorization: `Bearer ${token}` } });
      pendingAutoPlay.current = true;
      // Replacing an audio source starts an asynchronous native load.
      // Calling play() before isLoaded can fail on Android; the effect below
      // handles the normal case when native status becomes ready later.
      if (player.isLoaded) {
        pendingAutoPlay.current = false;
        try { player.play(); } catch { if (active) setError(true); }
      }
    })().catch(() => { if (active) { pendingAutoPlay.current = false; setError(true); } });

    const listener = AppState.addEventListener('change', state => {
      if (active && state !== 'active' && player.isLoaded) player.pause();
    });
    return () => {
      active = false;
      pendingAutoPlay.current = false;
      clearTimeout(timeout);
      listener.remove();
      // In particular, do not call replace(null), pause(), or release() here:
      // the useAudioPlayer hook may already have disposed its native handle.
    };
  }, [enabled, ready, text, retry, player]);

  useEffect(() => {
    if (!enabled || !ready || error || !pendingAutoPlay.current || !status.isLoaded || !player.isLoaded) return;
    pendingAutoPlay.current = false;
    try { player.play(); } catch { setError(true); }
  }, [enabled, ready, error, status.isLoaded, player, text, retry]);

  return <View style={{ gap: 8, marginVertical: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>Voice guidance (optional)</Text>
      <Switch accessibilityLabel="Voice guidance" value={enabled} onValueChange={value => {
        if (!value && player.isLoaded) player.pause();
        if (!value) pendingAutoPlay.current = false;
        setEnabled(value);
      }} />
    </View>
    {enabled && <>
      <Text accessibilityLiveRegion="polite" style={{ color: Colors.textSecondary, fontSize: 14 }}>
        {!ready ? 'Waiting for the correct page.' : error ? 'Audio could not start. You can still follow the text.' : status.playing ? 'Playing voice guidance.' : status.isLoaded ? 'Natural British-English AI narration.' : 'Preparing voice guidance…'}
      </Text>
      <TouchableOpacity accessibilityRole="button" disabled={!ready || (!error && !status.isLoaded)}
        style={{ minHeight: 44, justifyContent: 'center', opacity: !error && !status.isLoaded ? 0.5 : 1 }} onPress={() => {
        if (!ready) return;
        if (error) { setRetry(value => value + 1); return; }
        if (!status.isLoaded || !player.isLoaded) return;
        try {
          if (status.playing) player.pause();
          else { if (status.didJustFinish) void player.seekTo(0); player.play(); }
        } catch { setError(true); }
      }}>
        <Text style={{ color: Colors.accent, fontSize: 16, fontWeight: '700' }}>{error ? 'Try voice again' : status.playing ? 'Pause voice' : 'Play voice'}</Text>
      </TouchableOpacity>
    </>}
  </View>;
}
