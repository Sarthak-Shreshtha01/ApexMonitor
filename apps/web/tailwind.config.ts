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
        app: "#000000",
        background: "#000000",
        surface: "#050505",
        "surface-variant": "#0a0a0a",
        "surface-container-lowest": "#000000",
        "surface-container-low": "#050505",
        "surface-container": "#0a0a0a",
        "surface-container-high": "#141414",
        "surface-container-highest": "#1a1a1a",
        primary: "#ff4500",
        "primary-foreground": "#ffffff",
        "on-primary": "#000000",
        "primary-container": "#cc3600",
        "on-primary-container": "#ffffff",
        secondary: "#a3a3a3",
        tertiary: "#f59e0b",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
        muted: "#737373",
        outline: "#333333",
        "outline-variant": "#262626",
        "on-surface": "#ffffff",
        "on-surface-variant": "#a3a3a3",
        "danger-text": "#ef4444",
        "warning-text": "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        sm: "2px",
        md: "4px",
        lg: "8px",
        xl: "12px",
      },
    },
  },
};
export default config;