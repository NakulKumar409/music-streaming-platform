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
        'text-primary':   '#FFFFFF',
        'text-secondary': '#A1A1AA',
      },
      borderColor: {
        theme:   'var(--color-border-subtle)',
        muted:   'var(--color-border-muted)',
        primary: 'var(--color-border-primary)',
      },
      borderRadius: {
        xl:    '20px',
        '2xl': '24px',
        '3xl': '28px',
      },
      boxShadow: {
        'glow':        'var(--shadow-glow)',
        'glow-strong': 'var(--shadow-glow-strong)',
        'card':        'var(--shadow-card)',
        'premium':     '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-bg':      'var(--gradient-bg)',
      },
      backgroundSize: {
        '200%': '200% auto',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: 'var(--shadow-glow)' },
          '50%':       { boxShadow: 'var(--shadow-glow-strong)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        shimmer:     'shimmer 3s linear infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        fadeIn:      'fadeIn 0.4s ease-out forwards',
        float:       'float 3s ease-in-out infinite',
      },
      backdropBlur: {
        glass: '20px',
      },
    }
  },
  plugins: []
};
