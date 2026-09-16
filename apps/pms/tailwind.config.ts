import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F3F1EB",
        navy: "#1E3A5F",
        teal: "#0F766E",
        ink: "#17233A",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
