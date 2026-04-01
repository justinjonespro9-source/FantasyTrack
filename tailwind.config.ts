import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
      },
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
          900: "#313d49",
        },
        /** Premium dark UI — warm gold accent on charcoal */
        ft: {
          gold: "#d4af37",
          "gold-dim": "#a88b28",
          "gold-bright": "#e8c547",
          charcoal: "#0a0a0a",
          ink: "#050505",
          surface: "#111111",
          elevated: "#161616",
          border: "rgba(255, 255, 255, 0.06)",
          muted: "#8c8c8c",
          label: "#737373",
        },
      },
      boxShadow: {
        "ft-card":
          "0 4px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.045)",
        "ft-card-hover":
          "0 8px 40px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        "ft-glow-gold": "0 0 48px rgba(212, 175, 55, 0.14)",
        "ft-inner": "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        "ft-slip": "0 -8px 40px rgba(0, 0, 0, 0.75), 0 0 1px rgba(212, 175, 55, 0.2)",
      },
      backgroundImage: {
        "ft-radial-gold":
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(212, 175, 55, 0.12), transparent 55%)",
        "ft-gradient-dark": "linear-gradient(180deg, #141414 0%, #0a0a0a 55%, #050505 100%)",
        "ft-gradient-panel": "linear-gradient(145deg, rgba(22, 22, 22, 0.98) 0%, rgba(8, 8, 8, 0.99) 100%)",
        "ft-cta": "linear-gradient(135deg, #e8c547 0%, #d4af37 45%, #a67c00 100%)",
      },
      borderRadius: {
        ft: "14px",
        "ft-lg": "18px",
      },
      transitionDuration: {
        ft: "240ms",
      },
      keyframes: {
        "ft-leader-pulse": {
          "0%, 100%": {
            boxShadow:
              "0 0 0 1px rgba(212, 175, 55, 0.35), 0 0 28px rgba(212, 175, 55, 0.12)",
          },
          "50%": {
            boxShadow:
              "0 0 0 1px rgba(212, 175, 55, 0.5), 0 0 40px rgba(212, 175, 55, 0.22)",
          },
        },
        "ft-odds-tick": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "40%": { opacity: "0.92", transform: "scale(0.995)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "ft-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "ft-leader-pulse": "ft-leader-pulse 2.8s ease-in-out infinite",
        "ft-odds-tick": "ft-odds-tick 0.45s ease-out",
        "ft-shimmer": "ft-shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
