import { describe, expect, it } from 'vitest';
import {
  getAccentBorder,
  getAccentClasses,
  getAccentColor,
  getAccentHex,
  getAccentHover,
  getAccentRing,
  getAccentSelected,
  getAccentSolid,
  getAccentText,
} from './accentColors';

describe('accentColors', () => {
  it('maps every variant to a semantic token utility', () => {
    // Accent hues now live in CSS (`--primary`, set per theme and per
    // data-accent), so the helpers must only ever emit token classes.
    expect(getAccentColor('orange')).toBe('bg-primary');
    expect(getAccentText('orange')).toBe('text-primary');
    expect(getAccentBorder('orange')).toBe('border-primary/30');
    expect(getAccentRing('orange')).toBe('ring-primary');
    expect(getAccentHover('orange')).toBe('hover:bg-primary/10');
    expect(getAccentSelected('orange')).toBe('bg-primary-soft text-primary');
    expect(getAccentSolid()).toBe('bg-primary text-primary-foreground');
  });

  it('defaults to the background variant', () => {
    expect(getAccentClasses('kiwi')).toBe('bg-primary');
    expect(getAccentClasses('kiwi', 'text')).toBe('text-primary');
  });

  it('never leaks a hard-coded palette class', () => {
    // Regression guard: the old implementation returned things like
    // `bg-orange-500 dark:bg-orange-400`, which Tailwind cannot generate when
    // the class is chosen at runtime.
    for (const variant of ['bg', 'text', 'border', 'ring', 'hover', 'selected'] as const) {
      const className = getAccentClasses('amber', variant);
      expect(className).not.toMatch(
        /\b(bg|text|border|ring)-(red|orange|amber|yellow|green|blue|purple|pink|teal|cyan|lime|indigo|gray|zinc|slate)-\d{2,3}\b/,
      );
    }
  });

  it('resolves the vivid display hex for a specific accent', () => {
    // Used for inline styles, charts and canvas, where a token cannot apply.
    expect(getAccentHex('kiwi')).toBe('#8E466D');
    expect(getAccentHex('blue')).toBe('#3b82f6');
    expect(getAccentHex('amber')).toBe('#f59e0b');
  });

  it('falls back to the default accent for unknown names', () => {
    expect(getAccentHex('chartreuse')).toBe(getAccentHex('kiwi'));
  });
});
