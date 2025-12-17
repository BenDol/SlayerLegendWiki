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
    },
  },
};
