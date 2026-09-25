/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canonical DESIGN.md v2 "Paper Map, Not Cockpit" Tokens
        paper: '#FAF8F5',      // Warm off-white app background
        surface: '#FFFFFF',    // Pure white cards, nav, panels
        ink: '#1F2933',        // Primary typography
        muted: '#6B7280',      // Secondary text, quiet honesty tags
        line: '#E5E0D8',       // 1px soft borders
        brand: {
          DEFAULT: '#0F6E5D',  // MargSetu Teal: primary buttons, active nav
          dark: '#0a4f43',
          light: '#e6f4f1',
        },
        safe: '#2E7D32',       // Risk < 4 (green)
        caution: '#E08A00',    // Risk 4-6 (amber)
        danger: '#C62828',     // Risk > 6 (red)
        blocked: '#8B1A1A',    // Veto / Blocked (dark red)
        emergency: '#6A3FA0',  // Emergency-only route (purple)
        sos: {
          DEFAULT: '#D32F2F',  // SOS button ONLY
          light: '#FDECEA',    // SOS-adjacent backgrounds
          dark: '#b71c1c',
        },
        // Backward-compatible risk hierarchy
        risk: {
          green: {
            DEFAULT: '#2E7D32',
            dark: '#1b5e20',
            bg: '#edf7ed',
            text: '#1e4620',
          },
          amber: {
            DEFAULT: '#E08A00',
            dark: '#b26a00',
            bg: '#fff8e1',
            text: '#663c00',
          },
          red: {
            DEFAULT: '#C62828',
            dark: '#8e1c1c',
            bg: '#fde8e8',
            text: '#5c1313',
          },
          blocked: {
            DEFAULT: '#8B1A1A',
            dark: '#5a1010',
            bg: '#fbebeb',
            border: '#8B1A1A',
            text: '#4a0d0d',
          },
          emergency: {
            DEFAULT: '#6A3FA0',
            dark: '#4a2c70',
            bg: '#f3eafd',
            border: '#6A3FA0',
            text: '#3b1f61',
          },
        },
        // Operational light console tokens
        ops: {
          surface: '#FFFFFF',
          panel: '#FAF8F5',
          border: '#E5E0D8',
          header: '#0F6E5D',
          accent: '#0F6E5D',
          warning: '#E08A00',
          critical: '#C62828',
          success: '#2E7D32',
        },
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
