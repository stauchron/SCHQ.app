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
        navy: "#062035",
        zand: "#f5f3f1",
        taupe: "#c4bcb7",
        tier: "#8a827c",
        body: "#5c5652",
        card: "#78716c",
        muted: "#a8a29e",
        line: "#e8e4e0",
      },
      fontFamily: {
        sans: ["Whitney", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        button: "0.28em",
        eyebrow: "0.3em",
      },
      transitionTimingFunction: {
        staudt: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
