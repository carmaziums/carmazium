import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Mirrors the operating-system Reduce Motion preference.
 *
 * Keep motion-sensitive components on this shared hook so VoiceOver/TalkBack
 * and reduced-motion behaviour do not drift screen by screen.
 */
export function useReduceMotionPreference(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
