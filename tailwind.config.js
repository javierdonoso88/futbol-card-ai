/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        oswald: ['Oswald', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        gold: {
          light: '#FFF2AA',
          DEFAULT: '#FFD700',
          dark: '#B8860B',
          deep: '#8B6914',
          shadow: '#5C4409',
        },
        pitch: {
          light: '#1a4731',
          DEFAULT: '#0d2818',
          dark: '#060f0a',
        },
      },
    },
  },
  plugins: [],
}
