import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#18181B",
          light: "#27272A",
          muted: "#52525B",
          subtle: "#71717A",
        },
        purple: {
          DEFAULT: "#7C3AED",
          light: "#8B5CF6",
          dark: "#6D28D9",
          muted: "#A78BFA",
          50: "#FAF5FF",
          100: "#F3E8FF",
          200: "#E9D5FF",
          300: "#DDD6FE",
        },
        // Legacy aliases mapped to new palette
        navy: {
          DEFAULT: "#18181B",
          light: "#7C3AED",
          muted: "#52525B",
        },
        baby: {
          50: "#FAF5FF",
          100: "#F3E8FF",
          200: "#E9D5FF",
          300: "#DDD6FE",
          400: "#A78BFA",
        },
        view: "#7C3AED",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(24, 24, 27, 0.06), 0 1px 2px rgba(24, 24, 27, 0.04)",
        card: "0 1px 4px rgba(124, 58, 237, 0.1)",
        glow: "0 0 0 1px rgba(124, 58, 237, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
