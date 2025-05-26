// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary-dark": "#1A202C",
        "secondary-dark": "#2D3748",
        "border-dark": "#4A5568",
        "accent-blue": "#3B82F6",
        "text-primary": "#E2E8F0",
        "text-secondary": "#A0AEC0",
        "finding-green": "#22C55E",
        "finding-purple": "#A855F7",
        "finding-blue": "#60A5FA",
        "finding-darker-blue": "#3B82F6",
        "finding-red": "#EF4444",
        "finding-gray": "#6B7280",
      },
    },
  },
  plugins: [],
};
export default config;
