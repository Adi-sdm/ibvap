/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        borderDark: '#1E293B',
        panelDark: '#0F172A',
        panelElevated: '#1E293B',
        accentBlue: '#38BDF8',
        tacticalGreen: '#22C55E',
        tacticalAmber: '#F59E0B',
        tacticalRed: '#EF4444'
      }
    },
  },
  plugins: [],
}
