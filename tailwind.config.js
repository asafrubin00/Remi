/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        remi: {
          navy: "#101C2A",
          secondary: "#152334",
          surface: "#1E3043",
          gold: "#C5A469",
          "gold-light": "#DDC394",
          text: "#F4F1EB",
          "text-secondary": "#B0BDCA",
          muted: "#8C9EAF",
          border: "#304052",
          positive: "#77C3A3",
          negative: "#E69086",
          blue: "#3498DB",
          purple: "#9B59B6"
        }
      }
    }
  },
  plugins: []
};
