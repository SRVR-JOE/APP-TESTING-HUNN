/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        'gc-blue': '#0078d4',
        'gc-dark': '#1a1a2e',
        'gc-panel': '#16213e',
        'gc-accent': '#00b4d8',
      },
    },
  },
  plugins: [],
};
