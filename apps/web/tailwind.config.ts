import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./shared/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core Brand Colors mapped from your HTML
        primary: "#c0c1ff",
        "on-primary": "#1000a9",
        "primary-container": "#8083ff",
        secondary: "#5de6ff",
        tertiary: "#ffb783",
        background: "#101419",
        surface: "#101419",
        "on-surface": "#e0e2ea",
        "surface-variant": "#31353b",
        "on-surface-variant": "#c7c4d7",
        "surface-container-lowest": "#0a0e13",
        "surface-container-low": "#181c21",
        "surface-container": "#1c2025",
        "surface-container-high": "#262a30",
        "surface-container-highest": "#31353b",
        outline: "#464554",
        "outline-variant": "#464554",
        error: "#ffb4ab",
        "danger-text": "#ffb4ab", // Mapped for dashboard
        "warning-text": "#ffb783", // Mapped for dashboard
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
};
export default config;