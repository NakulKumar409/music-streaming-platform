import { getActiveTheme } from '../config/themeConfig';

export const colors = {
  // Backgrounds
  get background() {
    return getActiveTheme().bg;
  },
  get backgroundCard() {
    return getActiveTheme().card;
  },
  get backgroundGlow() {
    return getActiveTheme().surface;
  },
  backgroundGlass: 'rgba(20, 20, 35, 0.6)',

  // Accents
  get primary() {
    return getActiveTheme().primary;
  },
  get secondary() {
    return getActiveTheme().secondary;
  },
  get accent() {
    return getActiveTheme().accent;
  },
  highlight: '#06B6D4',
  
  // Gradients (for linear gradients)
  heroGradient: ['rgba(7, 7, 10, 0)', 'rgba(7, 7, 10, 0.95)'] as const,
  get purpleBlueGradient() {
    const t = getActiveTheme();
    return [t.gradientStart, t.gradientEnd] as const;
  },
  get magentaPurpleGradient() {
    const t = getActiveTheme();
    return [t.secondary, t.primary] as const;
  },
  darkGlassGradient: ['rgba(30, 27, 47, 0.8)', 'rgba(15, 12, 28, 0.8)'] as const,

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#E2E8F0',
  textMuted: '#94A3B8',
  textInactive: '#64748B',

  // Borders & Dividers
  borderThin: 'rgba(255, 255, 255, 0.08)',
  get borderGlow() {
    return `${getActiveTheme().primary}4D`;
  },
};
