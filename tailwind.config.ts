import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        track: {
          50: "#f6f7f9",
          100: "#eceff3",
          200: "#d7dee7",
          300: "#b8c6d6",
          400: "#8aa0bb",
          500: "#607d9c",
          600: "#4c647f",
          700: "#3f5267",
          800: "#374656",
          900: "#313d49"
        }
      }
    }
  },
  plugins: []
};

export default config;
