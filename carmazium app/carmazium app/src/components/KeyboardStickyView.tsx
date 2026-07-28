import React from 'react';
import { KeyboardAvoidingView, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

interface KeyboardStickyViewProps {
  style?: StyleProp<ViewStyle>;
  /** Only meaningful on iOS — Android always uses the height-driven approach below. */
  behavior?: 'padding' | 'height';
  keyboardVerticalOffset?: number;
  children: React.ReactNode;
}

/**
 * Drop-in replacement for wrapping a screen (or a section of one) in
 * KeyboardAvoidingView. iOS keeps the native component, which already works
 * reliably. Android instead drives `marginBottom` straight off the native
 * keyboard-show event (see useKeyboardHeight.ts) — KeyboardAvoidingView's
 * own Android behavior computes its shift from a view frame captured on
 * layout, which races with react-native-screens' Fragment inset delivery
 * under the edge-to-edge display Expo SDK 54 forces on. That race is exactly
 * the "keyboard covers the field, fixed after you back out and back in" bug.
 */
export const KeyboardStickyView: React.FC<KeyboardStickyViewProps> = ({
  style,
  behavior = 'padding',
  keyboardVerticalOffset,
  children,
}) => {
  const androidKeyboardHeight = useKeyboardHeight();

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={style} behavior={behavior} keyboardVerticalOffset={keyboardVerticalOffset}>
        {children}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[style, { marginBottom: androidKeyboardHeight }]}>{children}</View>;
};
