/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Anthropic 品牌色
        primary: {
          DEFAULT: '#d97757',   // 橙色主强调
          hover: '#c96847',
          active: '#b95837',
        },
        secondary: {
          DEFAULT: '#6a9bcc',   // 蓝色次强调
          hover: '#5a8bbc',
        },
        tertiary: '#788c5d',    // 绿色第三强调
        // 中性色
        dark: '#141413',
        light: '#faf9f5',
        'mid-gray': '#b0aea5',
        'light-gray': '#e8e6dc',
        // 功能色
        success: '#788c5d',
        warning: '#d97757',
        error: '#d97757',
      },
      fontFamily: {
        sans: [
          '"Poppins"',
          'Arial',
          'sans-serif',
        ],
        serif: [
          '"Lora"',
          'Georgia',
          'serif',
        ],
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(20, 20, 19, 0.06)',
        'md': '0 4px 16px rgba(20, 20, 19, 0.10)',
        'lg': '0 8px 32px rgba(20, 20, 19, 0.14)',
        'hover': '0 12px 48px rgba(20, 20, 19, 0.18)',
      },
      backdropBlur: {
        xs: '10px',
      },
    },
  },
  plugins: [],
}
