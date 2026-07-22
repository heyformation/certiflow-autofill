import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        proforma: {
          primary: "#6E1F14",
          accent: "#A8442B",
          light: "#FBEEE9",
        },
        proskills: {
          primary: "#0B3D3D",
          accent: "#168F82",
          light: "#E8F5F3",
        },
      },
    },
  },
  plugins: [],
};
export default config;
