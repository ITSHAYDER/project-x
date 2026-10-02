import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F4F4EE",
        ink: "#223029",
        pine: {
          DEFAULT: "#3F5D52",
          soft: "#E4ECE5",
          dark: "#294238",
        },
        clay: {
          DEFAULT: "#D96F52",
          soft: "#FBE6DC",
        },
        hairline: "#D8DED7",
        sky: "#A8C8C1",
        night: "#223029",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
