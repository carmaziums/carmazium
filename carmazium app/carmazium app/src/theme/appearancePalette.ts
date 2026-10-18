import { Colors } from '../constants/colors';
import type { AppearanceMode } from '../store/appearanceStore';

/** Matches the public website's src/app/globals.css root and .dark tokens. */
const light = {
  background: '#EEF5FB',
  card: '#FFFFFF',
  elevated: '#F7FBFF',
  input: '#E5EEF7',
  text: '#0F172A',
  secondary: '#334155',
  muted: '#64748B',
  border: '#D5E1EC',
  header: '#FFFFFF',
  tab: '#FFFFFF',
};
const dark = {
  background: Colors.bgPrimary,
  card: Colors.bgCardSolid,
  elevated: Colors.bgSecondary,
  input: Colors.inputBg,
  text: Colors.textPrimary,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  border: Colors.borderSubtle,
  header: '#1E293B',
  tab: '#243047',
};
export type AppearancePalette = typeof light;
export const appearancePalette = (mode: AppearanceMode): AppearancePalette =>
  mode === 'light' ? light : dark;
