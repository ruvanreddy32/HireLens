/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surface scale
        'surface':                  '#f8f9ff',
        'surface-dim':              '#cbdbf5',
        'surface-bright':           '#f8f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#eff4ff',
        'surface-container':        '#e5eeff',
        'surface-container-high':   '#dce9ff',
        'surface-container-highest':'#d3e4fe',
        'surface-variant':          '#d3e4fe',
        'surface-tint':             '#0053db',

        // On-surface
        'on-surface':               '#0b1c30',
        'on-surface-variant':       '#434655',
        'inverse-surface':          '#213145',
        'inverse-on-surface':       '#eaf1ff',

        // Outline
        'outline':                  '#737686',
        'outline-variant':          '#dbe5f5',
        'outline-subtle':           '#eef4ff',

        // Primary
        'primary':                  '#004ac6',
        'on-primary':               '#ffffff',
        'primary-container':        '#2563eb',
        'on-primary-container':     '#eeefff',
        'primary-fixed':            '#dbe1ff',
        'primary-fixed-dim':        '#b4c5ff',
        'on-primary-fixed':         '#00174b',
        'on-primary-fixed-variant': '#003ea8',
        'inverse-primary':          '#b4c5ff',

        // Secondary
        'secondary':                '#515f74',
        'on-secondary':             '#ffffff',
        'secondary-container':      '#d5e3fc',
        'on-secondary-container':   '#57657a',
        'secondary-fixed':          '#d5e3fc',
        'secondary-fixed-dim':      '#b9c7df',
        'on-secondary-fixed':       '#0d1c2e',
        'on-secondary-fixed-variant':'#3a485b',

        // Tertiary
        'tertiary':                 '#824500',
        'on-tertiary':              '#ffffff',
        'tertiary-container':       '#a65900',
        'on-tertiary-container':    '#ffede1',
        'tertiary-fixed':           '#ffdcc3',
        'tertiary-fixed-dim':       '#ffb77d',
        'on-tertiary-fixed':        '#2f1500',
        'on-tertiary-fixed-variant':'#6e3900',

        // Error
        'error':                    '#ba1a1a',
        'on-error':                 '#ffffff',
        'error-container':          '#ffdad6',
        'on-error-container':       '#93000a',

        // Background
        'background':               '#f8f9ff',
        'on-background':            '#0b1c30',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        '2xl':   '1rem',
        full:    '9999px',
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
        'gutter':   '1rem',
        'margin':   '1.5rem',
      },
      fontFamily: {
        sans:         ['Inter', 'ui-sans-serif', 'system-ui'],
        'headline-lg':['Inter'],
        'body-md':    ['Inter'],
        'label-sm':   ['Inter'],
      },
      fontSize: {
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'body-md':     ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-sm':    ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(11, 28, 48, 0.04), 0 4px 14px -2px rgba(11, 28, 48, 0.05)',
        'card-hover': '0 12px 28px -4px rgba(0, 74, 198, 0.12), 0 4px 10px -2px rgba(11, 28, 48, 0.04)',
        'subtle': '0 1px 2px 0 rgba(11, 28, 48, 0.03)',
        'glow': '0 0 20px -3px rgba(37, 99, 235, 0.22)',
        'glow-emerald': '0 0 16px -2px rgba(16, 185, 129, 0.22)',
      },
    },
  },
  safelist: [
    // Status badge dynamic classes
    'bg-primary-fixed', 'text-primary',
    'bg-surface-container-highest',
    'bg-surface-container-high',
    'bg-amber-50', 'text-amber-800',
    'bg-purple-50', 'text-purple-700',
    'bg-surface-container', 'text-secondary',
    'bg-emerald-50', 'text-emerald-700',
    // Score colors
    'text-primary-container',
  ],
  plugins: [],
}
