export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-bg-rgb) / <alpha-value>)',
        surface:    'rgb(var(--color-surface-rgb) / <alpha-value>)',
        card:       'rgb(var(--color-card-rgb) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          hover:   'var(--color-accent-hover)',
          active:  'var(--color-accent-active)',
        },
        secondary: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
        accent:    'rgb(var(--color-accent-rgb) / <alpha-value>)',
        muted:     'var(--color-text-muted)',
        subtle:    'var(--color-text-secondary)',
        glass:     'var(--color-glass-bg)',
        inputbg:   'var(--color-input-bg)',
        overlay:   'var(--color-overlay)',
      },
      borderColor: {
        theme:    'var(--color-border-subtle)',
        muted:    'var(--color-border-muted)',
        primary:  'var(--color-border-primary)',
      },
      borderRadius: {
        xl:  '20px',
        '2xl': '24px',
        '3xl': '28px',
      },
      boxShadow: {
        'glow':       'var(--shadow-glow)',
        'glow-strong':'var(--shadow-glow-strong)',
        'card':       'var(--shadow-card)',
        'premium':    '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-bg':      'var(--gradient-bg)',
      },
      backdropBlur: {
        'glass': '20px',
      },
    }
  },
  plugins: []
};
