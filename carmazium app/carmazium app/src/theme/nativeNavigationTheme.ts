/**
 * Navigation chrome uses the same semantic colours as the website.
 *
 * Screens and shared modal contents are migrated independently in Blocks 4–9.
 * No theme selector is exposed until those views have been audited.
 */
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import {
  type NativeSemanticPalette,
  type ResolvedAppearance,
} from './nativeTheme';

export type NativeChromeColors = Readonly<{
  background: string;
  headerBackground: string;
  foreground: string;
  secondaryForeground: string;
  border: string;
  tabBackground: string;
  tabInactive: string;
  accent: string;
}>;

export function getNativeChromeColors(
  mode: ResolvedAppearance,
  palette: NativeSemanticPalette,
): NativeChromeColors {
  return {
    background: palette.bgBody,
    headerBackground: palette.bgHeader,
    foreground: palette.textPrimary,
    secondaryForeground: palette.textSecondary,
    border: palette.borderDefault,
    tabBackground: mode === 'dark' ? palette.bgDropdown : palette.bgCard,
    tabInactive: palette.textMuted,
    accent: palette.accent,
  };
}

export function createNativeNavigationTheme(
  mode: ResolvedAppearance,
  palette: NativeSemanticPalette,
): Theme {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const colors = getNativeChromeColors(mode, palette);
  // Spread base to retain the React Navigation native typography contract.
  // Do not include a theme-dependent key on NavigationContainer: re-mounting
  // it would lose the current route, in-progress forms, or dealer workspace.
  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.tabBackground,
      text: colors.foreground,
      border: colors.border,
      notification: colors.accent,
    },
  };
}
