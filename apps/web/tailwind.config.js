/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0070f3',
          hover: '#0060df',
          muted: 'rgba(0, 112, 243, 0.15)',
        },
        secondary: {
          DEFAULT: '#f0f0f0',
          dark: '#e5e5e5',
        },
        accent: {
          DEFAULT: '#4caf50',
          hover: '#43a047',
          muted: 'rgba(76, 175, 80, 0.15)',
        },
        surface: {
          DEFAULT: 'var(--armai-surface)',
          elevated: 'var(--armai-surface-elevated)',
        },
      },
      fontFamily: {
        sans: ['Phetsarath OT', 'Noto Sans Lao', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
