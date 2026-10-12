import { Platform } from 'react-native';
import { getActiveTheme } from './config/themeConfig';

const isWeb = Platform.OS === 'web';

export const Colors = {
  // Background for app surfaces
  get background() {
    return isWeb ? 'var(--color-bg)' : getActiveTheme().bg;
  },
  get backgroundAlt() {
    return isWeb ? 'var(--color-surface)' : getActiveTheme().surface;
  },
  get card() {
    return isWeb ? 'var(--color-card)' : getActiveTheme().card;
  },

  // Accent colors from the active theme
  get accent() {
    return isWeb ? 'var(--color-primary)' : getActiveTheme().primary;
  },
  get accentSecondary() {
    return isWeb ? 'var(--color-secondary)' : getActiveTheme().secondary;
  },
  
  // Gradients reflecting the active theme
  get backgroundGradient() {
    const t = getActiveTheme();
    return [t.bg, t.surface, t.bg] as const;
  },
  get primaryGradient() {
    const t = getActiveTheme();
    return isWeb 
      ? (['var(--color-primary)', 'var(--color-secondary)', 'var(--color-bg)'] as const)
      : ([t.gradientStart, t.gradientEnd, t.bg] as const);
  },
  get accentGradient() {
    const t = getActiveTheme();
    return isWeb 
      ? (['var(--color-primary)', 'var(--color-secondary)', 'var(--color-bg)'] as const)
      : ([t.gradientStart, t.gradientEnd, t.bg] as const);
  },

  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.6)',
};
