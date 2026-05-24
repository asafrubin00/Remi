/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        remi: {
          navy: "#0D1F35",
          secondary: "#132B45",
          surface: "#1A3A5C",
          gold: "#C8960C",
          "gold-light": "#E8B84B",
          text: "#F0F4F8",
          "text-secondary": "#8CA8C0",
          muted: "#4A6278",
          border: "#1E3A52",
          positive: "#2ECC71",
          negative: "#E74C3C",
          blue: "#3498DB",
          purple: "#9B59B6"
        }
      }
    }
  },
  plugins: []
};
