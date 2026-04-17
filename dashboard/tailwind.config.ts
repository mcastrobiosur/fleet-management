import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#eb681a',
        'on-primary': '#ffffff',
        secondary: '#659833',
        surface: '#ede7e0',
        'surface-container-low': '#f5f1ed',
        'surface-container': '#ede7e0',
        'surface-container-high': '#e5dfd8',
        'surface-container-highest': '#ddd7d0',
        'on-surface': '#1d1b17',
        'on-surface-variant': '#4d4639',
        outline: '#85736e',
        error: '#ba1a1a',
        'brand-dark': '#2b1700',
        'brand-light': '#fff8f1',
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '1rem',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
