import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        leaf: { DEFAULT: '#1F4D3A', dark: '#153629', tint: '#E3EEE8' },
        saffron: { DEFAULT: '#E7A21B', tint: '#FBEFD0' },
        paper: '#F4F5F1',
        ink: '#1B1F1D',
        chili: '#C0392B',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
