/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Customer app theme — see docs/shopassist-ui-plan.md §3.2.
        // brand is reserved for one meaning: call/verify actions.
        brand: {
          DEFAULT: '#80c341',
          strong: '#6ba836',
        },
        accent: '#87BD28',
        ink: '#252525',
        amber: {
          DEFAULT: '#B9791E',
          bg: '#FBF0DC',
        },
        error: {
          DEFAULT: '#A94A3D',
          bg: '#F8E4E0',
        },
      },
    },
  },
  plugins: [],
};