import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssTypography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        peach: {
          DEFAULT: "hsl(var(--peach))",
          foreground: "hsl(var(--peach-foreground))",
        },
        mustard: {
          DEFAULT: "hsl(var(--mustard))",
          foreground: "hsl(var(--mustard-foreground))",
        },
        mint: {
          DEFAULT: "hsl(var(--mint))",
          foreground: "hsl(var(--mint-foreground))",
        },
        cream: {
          DEFAULT: "hsl(var(--cream))",
          foreground: "hsl(var(--cream-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        gps: {
          dot: "hsl(var(--gps-dot))",
          ring: "hsl(var(--gps-ring))",
          beam: "hsl(var(--gps-beam))",
        },
      },
      borderRadius: {
        "3xl": "1rem",
        "4xl": "1.25rem",
      },
      boxShadow: {
        'flat': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'flat-dark': '0 1px 2px rgba(0, 0, 0, 0.2)',
        'dropdown': '0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        'dropdown-dark': '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssTypography],
};
export default config;
