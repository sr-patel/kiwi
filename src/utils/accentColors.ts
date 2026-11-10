/**
 * Accent colour helpers.
 *
 * These used to return hard-coded Tailwind class maps (`bg-orange-500`,
 * `dark:bg-orange-400`, …) selected in JavaScript. Two problems with that:
 *
 *  - Tailwind cannot see class names built at runtime, so any dynamically
 *    composed variant silently produced dead CSS.
 *  - Light/dark contrast had to be hand-written per hue, which is why some
 *    accents ended up with white text on a yellow fill.
 *
 * Now the helpers return *semantic token* utilities (`bg-primary`,
 * `text-primary`, …). The actual hue lives in CSS (`--primary`), set per theme
 * and per accent from `data-accent` on <html>. Switching accent repaints
 * without re-rendering, and contrast is correct in both themes.
 *
 * Note: token utilities always reflect the *active* accent. To render a
 * specific accent that is not the active one (e.g. the Settings swatches), use
 * `getAccentHex()` for an inline colour instead.
 */

export type AccentVariant = 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'selected';

/** Vivid hue per accent, for inline styles, charts and canvas drawing. */
const DISPLAY_HEX: Record<string, string> = {
  kiwi: '#8E466D',
  orange: '#f97316',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  red: '#ef4444',
  pink: '#ec4899',
  teal: '#14b8a6',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  lime: '#84cc16',
  amber: '#f59e0b',
};

const VARIANT_CLASSES: Record<AccentVariant, string> = {
  bg: 'bg-primary',
  text: 'text-primary',
  border: 'border-primary/30',
  ring: 'ring-primary',
  hover: 'hover:bg-primary/10',
  selected: 'bg-primary-soft text-primary',
};

/**
 * Kept for call-site compatibility: the first argument is accepted but the
 * result is always the active accent's token utility.
 */
export const getAccentClasses = (_accentColor: string, variant: AccentVariant = 'bg'): string =>
  VARIANT_CLASSES[variant];

export const getAccentColor = (accentColor: string) => getAccentClasses(accentColor, 'bg');

export const getAccentText = (accentColor: string) => getAccentClasses(accentColor, 'text');

export const getAccentBorder = (accentColor: string) => getAccentClasses(accentColor, 'border');

export const getAccentRing = (accentColor: string) => getAccentClasses(accentColor, 'ring');

export const getAccentHover = (accentColor: string) => getAccentClasses(accentColor, 'hover');

export const getAccentSelected = (accentColor: string) => getAccentClasses(accentColor, 'selected');

/** Vivid hex for a specific accent, regardless of which accent is active. */
export const getAccentHex = (accentColor: string): string => DISPLAY_HEX[accentColor] ?? DISPLAY_HEX.kiwi;

/** Solid-fill pair for a specific accent, e.g. `<span className={...}>`. */
export const getAccentSolid = (): string => 'bg-primary text-primary-foreground';
