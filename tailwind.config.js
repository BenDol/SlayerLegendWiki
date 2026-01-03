import frameworkConfig from './wiki-framework/tailwind.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  // Extend the framework's Tailwind configuration
  ...frameworkConfig,

  // Add your content paths
  content: [
    './index.html',
    './main.jsx',
    './src/**/*.{js,ts,jsx,tsx}',
    './wiki-framework/src/**/*.{js,ts,jsx,tsx}',
  ],

  // Safelist spirit gradient colors to ensure they're included in build
  safelist: [
    // Red spirits (Sala, Mum, Bo)
    'from-red-500',
    'via-red-500/40',
    'bg-red-500',
    'hover:border-red-400',
    // Blue spirits (Ark, Todd, Luga)
    'from-blue-500',
    'via-blue-500/40',
    'bg-blue-500',
    'hover:border-blue-400',
    // Green spirits (Herh, Zappy, Kart)
    'from-green-500',
    'via-green-500/40',
    'bg-green-500',
    'hover:border-green-400',
    // Sienna spirits (Loar, Radon, Noah)
    'from-amber-600',
    'via-amber-600/40',
    'bg-amber-500',
    'hover:border-amber-400',
    // All filter button
    'bg-gray-500',
    'hover:border-gray-400',
    // Gradient ends
    'to-transparent',
    // Fallback
    'from-gray-500',
    'to-gray-600',
  ],

  // You can override theme, plugins, etc. here
  theme: {
    ...frameworkConfig.theme,
    extend: {
      ...frameworkConfig.theme.extend,
      // Your custom theme extensions

      // Custom shadow system (Material Design 3 inspired)
      boxShadow: {
        'raised': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 0 rgba(0, 0, 0, 0.02)',
        'elevated': '0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 4px 6px -1px rgba(0, 0, 0, 0.04)',
        'floating': '0 4px 6px -2px rgba(0, 0, 0, 0.08), 0 10px 15px -3px rgba(0, 0, 0, 0.06)',
        'prominent': '0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 20px 25px -5px rgba(0, 0, 0, 0.08)',
        'inset-soft': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'inset-focus': 'inset 0 1px 3px 0 rgba(0, 0, 0, 0.06)',

        // Override Tailwind defaults for subtler shadows in light mode
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 0 rgba(0, 0, 0, 0.02)',
        'md': '0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 4px 6px -1px rgba(0, 0, 0, 0.04)',
        'lg': '0 4px 6px -2px rgba(0, 0, 0, 0.08), 0 10px 15px -3px rgba(0, 0, 0, 0.06)',
        'xl': '0 4px 6px -2px rgba(0, 0, 0, 0.08), 0 10px 15px -3px rgba(0, 0, 0, 0.06)',
        '2xl': '0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 20px 25px -5px rgba(0, 0, 0, 0.08)',
      },

      // Custom background colors for off-white surface system
      backgroundColor: {
        'surface-primary': '#fafafa',
        'surface-secondary': '#f5f5f5',
        'surface-tertiary': '#f0f0f0',
        'surface-elevated': '#fcfcfc',
      },
    },
  },
};
