import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const Colors = {
  // Solid black background for app surfaces
  background: isWeb ? 'var(--color-bg)' : '#000000',
  backgroundAlt: isWeb ? 'var(--color-surface)' : '#000000',

  // Accent colors from the reference gradient
  accent: isWeb ? 'var(--color-primary)' : '#FFB608',
  accentSecondary: isWeb ? 'var(--color-secondary)' : '#FF2553',
  
  // Primary brand gradient: Black -> Pink -> Black? or consistent with branding
  backgroundGradient: ['#000000', '#000000', '#000000'] as const,
  primaryGradient: isWeb 
    ? ['var(--color-primary)', 'var(--color-secondary)', '#000000'] as const
    : ['#FFB608', '#FF2553', '#000000'] as const,
  accentGradient: isWeb 
    ? ['var(--color-primary)', 'var(--color-secondary)', '#000000'] as const
    : ['#FFB608', '#FF2553', '#000000'] as const,

  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.6)',
};


