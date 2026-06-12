/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand:   '#1D9E75',
        teal:    '#4ECDC4',
        bg:      '#0F1923',
        surface: '#1A2633',
        border:  '#263545',
        text:    '#EEF3F6',
        muted:   '#7A9BB5',
        danger:  '#E24B4A',
        warn:    '#EF9F27',
      },
    },
  },
  plugins: [],
}
