/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wa: {
          dark: '#111b21',
          panel: '#202c33',
          border: '#2a3942',
          teal: '#00a884',
          'teal-dark': '#008069',
          green: '#25d366',
          light: '#f0f2f5',
          chatbg: '#efeae2',
          bubbleOut: '#d9fdd3',
          bubbleIn: '#ffffff',
        }
      }
    },
  },
  plugins: [],
}
