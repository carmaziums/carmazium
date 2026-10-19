import React from 'react';
import { StatusBar, type StatusBarProps } from 'react-native';
import { useAppearance } from '../theme/useAppearance';
import type { StatusBarTone } from '../theme/appearancePalette';

interface ThemedStatusBarProps extends Omit<StatusBarProps, 'barStyle'> {
  /**
   * Pin the indicator tone for screens whose top edge is ALWAYS dark in both
   * modes (full-bleed photo heroes, the navy brand header, camera views).
   * Leave unset everywhere else so light mode gets dark indicators.
   */
  tone?: StatusBarTone;
}

/**
 * Replaces the static light-content `<StatusBar>` that ~65 screens
 * shipped with: on a light page those white clock/battery glyphs vanish.
 * Defaults to transparent + translucent, matching every existing call site.
 */
export const ThemedStatusBar: React.FC<ThemedStatusBarProps> = ({
  tone,
  translucent = true,
  backgroundColor = 'transparent',
  ...rest
}) => {
  const { palette } = useAppearance();
  return (
    <StatusBar
      {...rest}
      barStyle={tone ?? palette.statusBar}
      translucent={translucent}
      backgroundColor={backgroundColor}
    />
  );
};

export default ThemedStatusBar;