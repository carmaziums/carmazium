import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useNativeAppearance } from '../theme/NativeAppearanceProvider';

/**
 * Website-matched input appearance without changing validation or form state.
 * Callers keep full React Native TextInput control (including selection, focus,
 * keyboard/secure entry, editability and accessibility).
 * Styling is applied LAST so legacy dark-only colour rules in a caller's
 * StyleSheet cannot override the active theme's readable foreground.
 */
export const ThemedTextField = forwardRef<TextInput, TextInputProps>(
  ({ style, placeholderTextColor, selectionColor, keyboardAppearance, ...props }, ref) => {
    const { resolvedAppearance, palette } = useNativeAppearance();
    return (
      <TextInput
        {...props}
        ref={ref}
        style={[
          styles.base,
          style,
          {
            backgroundColor: palette.bgInput,
            borderColor: palette.borderDefault,
            color: palette.textPrimary,
          },
        ]}
        placeholderTextColor={placeholderTextColor ?? palette.textMuted}
        selectionColor={selectionColor ?? palette.accent}
        keyboardAppearance={keyboardAppearance ?? resolvedAppearance}
      />
    );
  },
);

ThemedTextField.displayName = 'ThemedTextField';

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
