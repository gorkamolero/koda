import kodaPreset from '@koda/ui/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [kodaPreset],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
}
