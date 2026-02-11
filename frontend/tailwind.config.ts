/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'false',
  content: [
   './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        satoshi: ['Satoshi']
      },
      colors: {
        primary: {
          dark: '#1c2f65',
          DEFAULT: '#5a71b4',
          light: '#a9b7e0',
          lighter: '#ced9f9',
          lightest: '#e0e8ff'
          // dark: '#651c1c',
          // DEFAULT: '#b45a5a',
          // light: '#e0a9a9',
          // lighter: '#f9cece',
          // lightest: '#ffe0e0'
        }
      }
    },
  },
}

