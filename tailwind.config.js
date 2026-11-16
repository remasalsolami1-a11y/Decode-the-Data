/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { 950: '#0B1020', 900: '#111833', 800: '#1A2347', 700: '#2A3563', 500: '#5B6690', 400: '#8A93B5', 300: '#B9C0DA', 200: '#DCE0EE', 100: '#EEF0F7', 50: '#F7F8FC' },
        paper: '#FBFAF7',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,24,51,.06), 0 8px 24px -12px rgba(17,24,51,.18)',
        lift: '0 2px 4px rgba(17,24,51,.08), 0 18px 40px -16px rgba(17,24,51,.30)',
      },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.92)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        flow: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-40px)' } },
        shake: { '0%,100%': { transform: 'none' }, '25%': { transform: 'translateX(-4px)' }, '75%': { transform: 'translateX(4px)' } },
        strike: { '0%': { opacity: 1 }, '100%': { opacity: 0, transform: 'scaleY(0.2)', height: 0 } },
      },
      animation: {
        rise: 'rise .45s ease-out both',
        pop: 'pop .3s ease-out both',
        flow: 'flow 1.2s linear infinite',
        shake: 'shake .3s ease-in-out 2',
      },
    },
  },
  plugins: [],
};
