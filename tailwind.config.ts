import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "#d8dee7",
        ink: "#14202e",
        muted: "#5b6878",
        surface: "#f7f9fc",
        panel: "#ffffff",
        accent: "#0f7b7a",
        gold: "#b46b1f"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(20, 32, 46, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
