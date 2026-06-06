/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        orange: { DEFAULT: '#e8712a', dark: '#d4621f' },
        surface: '#111',
        border: '#1f1f1f',
        bg: '#0d0d0d',
      },
    },
  },
  plugins: [],
}
