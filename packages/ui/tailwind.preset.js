import animate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
  theme: {
  	extend: {
  		colors: {
            'surface-base': 'var(--surface-base)',
            ...Object.fromEntries(['terminal', 'composer', 'bubble', 'bubble-user', 'right-panel', 'approval'].map(surface => [`text-on-${surface}`, `var(--text-on-${surface})`])),
            'text-action': 'var(--text-action)',
			/* Gray scale for direct access */
			gray: {
				0: 'var(--gray-0)',
				1: 'var(--gray-1)',
				2: 'var(--gray-2)',
				3: 'var(--gray-3)',
				4: 'var(--gray-4)',
				5: 'var(--gray-5)',
				6: 'var(--gray-6)',
				7: 'var(--gray-7)',
				8: 'var(--gray-8)',
				9: 'var(--gray-9)',
				10: 'var(--gray-10)',
				11: 'var(--gray-11)',
				12: 'var(--gray-12)',
				13: 'var(--gray-13)',
				14: 'var(--gray-14)',
			},
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
  			'border-subtle': 'var(--border-subtle)',
  			'border-muted': 'var(--border-muted)',
  			'border-strong': 'var(--border-strong)',
  			'border-stronger': 'var(--border-stronger)',
  			'border-quiet': 'var(--border-quiet)',
  			'border-accent': 'var(--border-accent)',
  			'border-accent-soft': 'var(--border-accent-soft)',
  			'status-success': 'var(--status-success)',
  			'status-warning': 'var(--status-warning)',
  			'status-error': 'var(--status-error)',
  			'status-unknown': 'var(--status-unknown)',
  			'status-processing': 'var(--status-processing)',
  			'status-reviewing': 'var(--status-reviewing)',
  			'status-ready': 'var(--status-ready)',
  			'status-unread': 'var(--status-unread)',
  			'surface-review': 'var(--surface-review)',
  			'border-review': 'var(--border-review)',
  			'surface-review-active': 'var(--surface-review-active)',
  			'text-review-active': 'var(--text-review-active)',
  			'surface-review-done': 'var(--surface-review-done)',
  			'text-review-done': 'var(--text-review-done)',
			sidebar: {
				DEFAULT: 'var(--sidebar-background)',
				background: 'var(--sidebar-background)',
				foreground: 'var(--sidebar-foreground)',
				primary: 'var(--sidebar-primary)',
				'primary-foreground': 'var(--sidebar-primary-foreground)',
				accent: 'var(--sidebar-accent)',
				'accent-foreground': 'var(--sidebar-accent-foreground)',
				border: 'var(--sidebar-border)',
				ring: 'var(--sidebar-ring)',
			},
  			border: 'hsl(var(--border))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		spacing: {
            ...Object.fromEntries(['0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96'].map(value => [value, `var(--space-${value.replace('.', '_')})`])),
  			sidebar: 'var(--sidebar-width)',
  			topbar: 'var(--topbar-height)',
  			'right-panel': 'var(--right-panel-width)',
  			tabbar: 'var(--tabbar-height)',
  			titlebar: 'var(--titlebar-height)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'var(--radius-md)',
  			sm: 'var(--radius-sm)'
  		},
  		boxShadow: {
  			glow: 'var(--shadow-glow)',
  			accent: 'var(--shadow-accent-glow)',
  			popover: 'var(--shadow-popover)'
  		},
  		backdropBlur: {
  			glass: 'var(--glass-blur)'
  		},
  		backdropSaturate: {
  			glass: 'var(--glass-saturate)'
  		},
  		fontFamily: {
  			ui: [
  				'var(--font-ui)'
  			],
  			code: [
  				'var(--font-code)'
  			]
  		},
  		fontSize: {
            ...Object.fromEntries(['display', 'heading', 'label', 'body', 'caption', 'code'].map(role => [role, [`var(--type-${role}-size)`, { lineHeight: `var(--type-${role}-line-height)`, letterSpacing: `var(--type-${role}-tracking)` }]])),
            'display-sm': ['var(--type-display-sm-size)', { lineHeight: 'var(--type-display-line-height)' }],
            'display-md': ['var(--type-display-md-size)', { lineHeight: 'var(--type-display-line-height)' }],
            'display-lg': ['var(--type-display-lg-size)', { lineHeight: 'var(--type-display-line-height)' }],
        },
        zIndex: Object.fromEntries(['base', 'sticky', 'popover', 'modal', 'toast'].map(layer => [layer, `var(--layer-${layer})`])),
        transitionTimingFunction: {
            standard: 'var(--ease-standard)',
            enter: 'var(--ease-enter)',
            exit: 'var(--ease-exit)',
        },
        transitionDuration: {
  			fast: 'var(--transition-fast)',
  			normal: 'var(--transition-normal)',
  			slow: 'var(--transition-slow)'
  		},
  		animation: {
  			blink: 'blink var(--duration-blink) infinite',
  			shimmer: 'shimmer var(--duration-shimmer) infinite',
  			'pulse-glow': 'pulse-glow var(--duration-pulse) var(--ease-in-out) infinite',
  			'fade-in': 'fade-in var(--duration-enter) var(--ease-enter)',
  			'slide-up': 'slide-up var(--duration-slide) var(--ease-enter)',
  			'slide-down': 'slide-down var(--duration-slide) var(--ease-enter)',
  			'scale-in': 'scale-in var(--duration-enter) var(--ease-enter)',
  			'accordion-down': 'accordion-down var(--duration-slide) var(--ease-enter)',
  			'accordion-up': 'accordion-up var(--duration-slide) var(--ease-enter)'
  		},
  		keyframes: {
  			blink: {
  				'0%, 50%': {
  					opacity: '1'
  				},
  				'51%, 100%': {
  					opacity: '0'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
  			'pulse-glow': {
  				'0%, 100%': {
  					opacity: '1',
  					boxShadow: '0 0 8px currentColor'
  				},
  				'50%': {
  					opacity: '0.6',
  					boxShadow: '0 0 16px currentColor'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'slide-up': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'slide-down': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(-10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'scale-in': {
  				from: {
  					opacity: '0',
  					transform: 'scale(0.95)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'scale(1)'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		}
  	}
  },
  plugins: [animate],
}
