/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kui: {
          darker: '#0a0d14',
          dark: '#0f141f',
          surface: '#151b28',
          border: '#232d42',
          active: '#2f3b55',
          accent: '#06b6d4',
          accentHover: '#0891b2',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Kantumruy Pro"', '"Noto Sans Khmer"', 'monospace'],
        khmer: ['"Kantumruy Pro"', '"Noto Sans Khmer"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
