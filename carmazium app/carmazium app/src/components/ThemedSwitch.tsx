import React from 'react';
import { Switch, type SwitchProps } from 'react-native';
import { Colors } from '../constants/colors';
import { useAppearance } from '../theme/useAppearance';

/**
 * React Native Switch with appearance-aware defaults.
 *
 * Screens passed dark-only track colours (whiteAlpha10, borderMuted,
 * darkBlue_2a2a35). On a light card the "off" track was invisible, so an off
 * switch looked like a stray white dot. The off track now meets the 3:1
 * component-boundary minimum in light mode (#7C8BA1 on white, 3.5:1) and the
 * on track uses the deeper brand red there. Dark mode keeps the brand red and
 * a visible translucent track. Explicit trackColor / thumbColor props still win.
 */
export const ThemedSwitch: React.FC<SwitchProps> = ({ trackColor, thumbColor, ios_backgroundColor, ...rest }) => {
  const { palette } = useAppearance();
  const track = { false: palette.switchTrackOff, true: palette.accentSolid, ...(trackColor ?? {}) };
  return (
    <Switch
      {...rest}
      trackColor={track}
      thumbColor={thumbColor ?? Colors.white}
      ios_backgroundColor={ios_backgroundColor ?? track.false ?? palette.switchTrackOff}
    />
  );
};

export default ThemedSwitch;