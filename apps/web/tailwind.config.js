/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#D4AF37',
          hover: '#B8860B',
          muted: 'rgba(212, 175, 55, 0.15)',
          glow: 'rgba(212, 175, 55, 0.3)',
        },
        secondary: {
          DEFAULT: '#1A1A1A',
          dark: '#0f0f0f',
        },
        accent: {
          DEFAULT: '#FFFFFF',
          hover: '#f0f0f0',
          muted: 'rgba(255, 255, 255, 0.1)',
        },
        surface: {
          DEFAULT: 'var(--armai-surface)',
          elevated: 'var(--armai-surface-elevated)',
        },
      },
      fontFamily: {
        sans: ['Phetsarath OT', 'IBM Plex Sans', 'Noto Sans Lao', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 10px rgba(212, 175, 55, 0.3)',
        'gold-lg': '0 0 20px rgba(212, 175, 55, 0.25)',
      },
      transitionDuration: {
        luxury: '500ms',
      },
    },
  },
  plugins: [],
}
