import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

/**
 * Returns the current keyboard height in px (0 when hidden), driven directly
 * by the OS show/hide events rather than `KeyboardAvoidingView`'s frame-based
 * math. Expo SDK 54 / RN 0.81 make Android edge-to-edge display mandatory
 * (react-native-screens pulls in `react-native-is-edge-to-edge` to detect
 * this), and under edge-to-edge `windowSoftInputMode="adjustResize"` no
 * longer resizes the Activity window — `KeyboardAvoidingView` computes its
 * shift from a view frame captured via `onLayout`, which races with the
 * safe-area/inset callbacks on a react-native-screens Fragment's first mount.
 * That race is exactly the "keyboard covers the field, works after you back
 * out and come back" bug: the second time, the frame is already cached
 * correctly. Reading the keyboard height straight off the native event sidesteps
 * that race entirely — nothing here depends on a previously-measured layout.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
