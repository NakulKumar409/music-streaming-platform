export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#121212',
        card: '#181818',
        primary: '#FF7A2F',
        secondary: '#FF9B5C',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A1A1AA',
      },
      borderRadius: {
        'xl': '20px',
        '2xl': '24px',
        '3xl': '28px',
      },
      boxShadow: {
        'glow': '0 0 40px rgba(255, 122, 47, 0.15)',
        'glow-strong': '0 0 60px rgba(255, 122, 47, 0.25)',
        'premium': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        'glass': '20px',
      },
    }
  },
  plugins: []
};
