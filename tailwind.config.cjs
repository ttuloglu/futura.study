/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './ai.ts',
    './firebaseConfig.ts',
    './theme.ts',
    './components/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif']
      },
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface-glass)',
        'surface-pure': 'var(--color-surface-pure)',
        border: 'var(--color-border)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--color-accent-green)',
          red: 'var(--color-accent-red)',
          green: 'var(--color-accent-green)',
          yellow: 'var(--color-accent-yellow)',
        }
      },
      boxShadow: {
        'premium': 'var(--shadow-premium)',
        'neumorphic': 'var(--shadow-neumorphic)',
        'neumorphic-sm': 'var(--shadow-neumorphic-sm)',
        'neumorphic-inset': 'var(--shadow-neumorphic-inset)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      animation: {
        enter: 'enter 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in': 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'float': 'float 6s ease-in-out infinite'
      },
      keyframes: {
        enter: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
};
