/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Text hierarchy (10 levels)
        'text-primary': 'var(--text-primary)',
        'text-strong': 'var(--text-strong)',
        'text-emphasis': 'var(--text-emphasis)',
        'text-stronger': 'var(--text-stronger)',
        'text-quiet': 'var(--text-quiet)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        'text-faint': 'var(--text-faint)',
        'text-fainter': 'var(--text-fainter)',
        'text-dim': 'var(--text-dim)',
        'text-accent': 'var(--text-accent)',

        // Surface hierarchy (semantic surfaces)
        'surface-sidebar': 'var(--surface-sidebar)',
        'surface-sidebar-opaque': 'var(--surface-sidebar-opaque)',
        'surface-topbar': 'var(--surface-topbar)',
        'surface-right-panel': 'var(--surface-right-panel)',
        'surface-messages': 'var(--surface-messages)',
        'surface-composer': 'var(--surface-composer)',
        'surface-card': 'var(--surface-card)',
        'surface-card-strong': 'var(--surface-card-strong)',
        'surface-card-muted': 'var(--surface-card-muted)',
        'surface-item': 'var(--surface-item)',
        'surface-control': 'var(--surface-control)',
        'surface-control-hover': 'var(--surface-control-hover)',
        'surface-control-disabled': 'var(--surface-control-disabled)',
        'surface-hover': 'var(--surface-hover)',
        'surface-active': 'var(--surface-active)',
        'surface-popover': 'var(--surface-popover)',
        'surface-bubble': 'var(--surface-bubble)',
        'surface-bubble-user': 'var(--surface-bubble-user)',
        'surface-terminal': 'var(--surface-terminal)',
        'surface-approval': 'var(--surface-approval)',
        'surface-debug': 'var(--surface-debug)',
        'surface-diff-card': 'var(--surface-diff-card)',

        // Border hierarchy
        'border-subtle': 'var(--border-subtle)',
        'border-muted': 'var(--border-muted)',
        'border-strong': 'var(--border-strong)',
        'border-stronger': 'var(--border-stronger)',
        'border-quiet': 'var(--border-quiet)',
        'border-accent': 'var(--border-accent)',
        'border-accent-soft': 'var(--border-accent-soft)',

        // Status colors
        'status-success': 'var(--status-success)',
        'status-warning': 'var(--status-warning)',
        'status-error': 'var(--status-error)',
        'status-unknown': 'var(--status-unknown)',
        'status-processing': 'var(--status-processing)',
        'status-reviewing': 'var(--status-reviewing)',
        'status-ready': 'var(--status-ready)',
        'status-unread': 'var(--status-unread)',

        // Review colors
        'surface-review': 'var(--surface-review)',
        'border-review': 'var(--border-review)',
        'surface-review-active': 'var(--surface-review-active)',
        'text-review-active': 'var(--text-review-active)',
        'surface-review-done': 'var(--surface-review-done)',
        'text-review-done': 'var(--text-review-done)',

        // Legacy compatibility
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
      },

      // Layout dimensions
      spacing: {
        'sidebar': 'var(--sidebar-width)',
        'topbar': 'var(--topbar-height)',
        'right-panel': 'var(--right-panel-width)',
        'tabbar': 'var(--tabbar-height)',
        'titlebar': 'var(--titlebar-height)',
      },

      // Border radius
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // Box shadows
      boxShadow: {
        'glow': 'var(--shadow-glow)',
        'accent': '0 0 20px var(--shadow-accent)',
        'popover': '0 8px 30px rgba(0, 0, 0, 0.4)',
      },

      // Backdrop blur
      backdropBlur: {
        'glass': 'var(--glass-blur)',
      },

      // Backdrop saturate
      backdropSaturate: {
        'glass': 'var(--glass-saturate)',
      },

      // Font families
      fontFamily: {
        'ui': ['var(--font-ui)'],
        'code': ['var(--font-code)'],
      },

      // Transitions
      transitionDuration: {
        'fast': 'var(--transition-fast)',
        'normal': 'var(--transition-normal)',
        'slow': 'var(--transition-slow)',
      },

      // Animations
      animation: {
        'blink': 'blink 1s infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-glow': 'pulse-glow 1.2s ease-in-out infinite',
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'slide-down': 'slide-down 200ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
      },

      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px currentColor' },
          '50%': { opacity: '0.6', boxShadow: '0 0 16px currentColor' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
