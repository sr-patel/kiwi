import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccentColor, getAccentHex, getAccentText } from './accentColors';
import { useAppStore } from '@/store';

describe('accentColors', () => {
  beforeEach(() => {
    useAppStore.setState({ accentColor: 'kiwi', enableColorIntegration: true });
    localStorage.clear();
  });

  it('maps an accent to its utility classes', () => {
    expect(getAccentColor('orange')).toContain('bg-orange-500');
    expect(getAccentText('orange')).toContain('text-orange-600');
  });

  it('falls back to the default accent for unknown names', () => {
    expect(getAccentColor('chartreuse')).toBe(getAccentColor('kiwi'));
    expect(getAccentHex('chartreuse')).toBe(getAccentHex('kiwi'));
  });

  it('returns neutral values when colour integration is disabled', () => {
    useAppStore.setState({ enableColorIntegration: false });
    expect(getAccentText('orange')).toContain('text-gray-700');
    expect(getAccentHex('orange')).toBe('#6b7280');
  });

  it('never reads persisted storage during a lookup', () => {
    // Regression guard: lookups used to JSON.parse the whole persisted store on
    // every call, and these run dozens of times per rendered element and up to
    // 60 times a second from the audio visualizer.
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    getAccentHex('blue');
    getAccentColor('blue');
    getAccentText('blue');
    expect(getItem).not.toHaveBeenCalled();
    getItem.mockRestore();
  });
});
