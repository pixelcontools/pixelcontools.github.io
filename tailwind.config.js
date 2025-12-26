/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'canvas-bg': '#282c34',
        'panel-bg': '#36393f',
        'border': '#44474d',
        'gray-850': '#3a3f47',
      },
    },
  },
  plugins: [],
}
