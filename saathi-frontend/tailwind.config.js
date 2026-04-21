/* @type {import('tailwindcss').Config} */
// DELETE THIS LINE → import { tokens } from "./src/lib/tokens";

module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy:  "#0F2D52",
        blue:  "#1A56A0",
        teal:  "#0E7C7B",
        amber: "#A85C00",
        red:   "#A8001E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "720px",
      },
    },
  },
  plugins: [],
}