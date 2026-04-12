/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      animation: {
        'pulse-yellow': 'pulseYellow 1.5s ease-in-out infinite',
        'glow-green': 'glowGreen 2s ease-in-out infinite',
      },
      keyframes: {
        pulseYellow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(250, 204, 21, 0.7)' },
          '50%': { boxShadow: '0 0 30px rgba(250, 204, 21, 1)' },
        },
        glowGreen: {
          '0%, 100%': { boxShadow: '0 0 6px rgba(34, 197, 94, 0.7)' },
          '50%': { boxShadow: '0 0 18px rgba(34, 197, 94, 1)' },
        },
      },
    },
  },
  plugins: [],
};
