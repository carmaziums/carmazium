import { useAppearanceStore } from '../store/appearanceStore';
import { appearancePalette, themedColor, themedFill, themedSurface, type AppearancePalette } from './appearancePalette';
import type { AppearanceMode } from '../store/appearanceStore';

export interface AppearanceContext {
  mode: AppearanceMode;
  isLight: boolean;
  /** Semantic colours for the active mode — use these for inline JSX colours
   *  (icon `color` props, conditional label colours, Switch tracks) instead of
   *  reading the dark-only `Colors.text*` / `Colors.white` tokens directly. */
  palette: AppearancePalette;
  /** Mode-aware foreground: returns `color` unchanged in dark mode and its
   *  readable light-mode equivalent in light mode. For text/icons drawn on the
   *  page or a card — never for labels on a solid brand/semantic fill. */
  tc: (color: string) => string;
  /** Mode-aware surface: dark neutral fills become light cards in light mode. */
  tbg: (color: string, kind?: 'card' | 'elevated') => string;
  /** Mode-aware solid semantic fill that keeps a white label readable. */
  tfill: (color: string) => string;
}

export function useAppearance(): AppearanceContext {
  const mode = useAppearanceStore(state => state.mode);
  return {
    mode,
    isLight: mode === 'light',
    palette: appearancePalette(mode),
    tc: color => themedColor(mode, color),
    tbg: (color, kind) => themedSurface(mode, color, kind),
    tfill: color => themedFill(mode, color),
  };
}

/**
 * Non-hook variant for module-level render helpers that are not components.
 * Callers must sit under a component that subscribes to the appearance store
 * (every screen does), so a mode change still re-renders them.
 */
export function themedColorNow(color: string): string {
  return themedColor(useAppearanceStore.getState().mode, color);
}