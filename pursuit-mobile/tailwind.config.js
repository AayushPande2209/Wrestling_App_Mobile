/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#FF6B2C' },
        surface: '#1C1C1E',
        border: '#38383A',
        bg: '#000000',
      },
    },
  },
  plugins: [],
}
