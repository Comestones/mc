/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          light: '#ffffff',
          dark: '#191919',
        },
        sidebar: {
          light: '#f7f6f3',
          dark: '#202020',
          hover: {
            light: '#eae8e3',
            dark: '#2d2d2d',
          }
        },
        surface: {
          light: '#ffffff',
          dark: '#252525',
        },
        border: {
          light: '#e9e7e2',
          dark: '#2e2e2e',
        },
        text: {
          primary: {
            light: '#37352f',
            dark: '#e3e2de',
          },
          muted: {
            light: '#787774',
            dark: '#9b9a97',
          }
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      }
    },
  },
  plugins: [],
}
