/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "remi-navy": "#0D1F35",
        "remi-text": "#F0F4F8"
      }
    }
  },
  plugins: []
};
