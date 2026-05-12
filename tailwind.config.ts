import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      colors: {
        ink: "#000000",
        panel: "#0c0c0e",
        line: "#1a1a1f",
        muted: "#8b8b96",
        accent: "#22f59e",
        accent2: "#4ade80",
        rarity: {
          common: "var(--cm-rarity-common)",
          rare: "var(--cm-rarity-rare)",
          epic: "var(--cm-rarity-epic)",
          mythic: "var(--cm-rarity-mythic)",
          genesis: "var(--cm-rarity-genesis)",
        },
        degen: {
          pink: "#ff4d9d",
          gold: "#fbbf24",
          felt: "#052e16",
        },
        cm: {
          neon: "var(--cm-neon)",
          mint: "var(--cm-mint)",
          violet: "var(--cm-violet)",
          danger: "var(--cm-danger)",
          panel: "var(--cm-panel-solid)",
        },
      },
      transitionDuration: {
        fast: "var(--cm-motion-fast)",
        base: "var(--cm-motion-base)",
        slow: "var(--cm-motion-slow)",
      },
      keyframes: {
        "cm-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "cm-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "cm-cta-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 245, 158, 0.35)" },
          "50%": { boxShadow: "0 0 28px 3px rgba(34, 245, 158, 0.22)" },
        },
        "cm-gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "cm-float": "cm-float 4s ease-in-out infinite",
        "cm-glow": "cm-glow 2.4s ease-in-out infinite",
        "cm-cta-pulse": "cm-cta-pulse 2.2s ease-in-out infinite",
        "cm-gradient-x": "cm-gradient-x 8s ease infinite",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-heading)", "var(--font-body)", "system-ui", "sans-serif"],
        premium: ["var(--font-premium)", "var(--font-heading)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(255,255,255,0.06), 0 18px 50px rgba(0,0,0,0.65)",
        glow: "0 0 48px rgba(34,245,158,0.14)",
        chip: "0 0 0 1px rgba(251,191,36,0.35), 0 12px 40px rgba(255,77,157,0.08)",
        "elev-1": "var(--cm-elev-1)",
        "elev-2": "var(--cm-elev-2)",
        "elev-glow": "var(--cm-shadow-glow)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
