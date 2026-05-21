/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        background: '#0a0a0a',
        card: '#111111',
        border: '#1f1f1f',
        muted: '#1a1a1a',
        foreground: '#fafafa',
        'muted-foreground': '#71717a',
        destructive: '#ef4444',
        success: '#22c55e',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        mono: ['SpaceMono', 'Courier'],
      },
    },
  },
  plugins: [],
}
