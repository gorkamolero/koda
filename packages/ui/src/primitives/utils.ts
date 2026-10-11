import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"
// Semantic utility names must merge by their role, not as arbitrary colors.
const twMerge = extendTailwindMerge({ extend: { classGroups: {
  shadow: [{ shadow: ['glow', 'accent', 'popover'] }],
  'font-size': [{ text: ['2xs', 'micro', 'tiny', 'display', 'heading', 'label', 'body', 'caption', 'code', 'display-sm', 'display-md', 'display-lg'] }],
} } })
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
