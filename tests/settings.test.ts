import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../src/platform/settings';
import { parseSelection } from '../src/platform/browser';
describe('settings boundary', () => {
  it.each([null, undefined, [], 'text', { version: 2 }])(
    'resets malformed or incompatible settings: %j',
    (input) => {
      expect(parseSettings(input)).toEqual(DEFAULT_SETTINGS);
    },
  );
  it('accepts only supported fields and values', () => {
    const result = parseSettings({
      version: 1,
      enabled: 'yes',
      preset: '__proto__',
      options: {
        format: 'script',
        links: 'javascript',
        removeTracking: false,
        normalizeWhitespace: 'yes',
        other: 'discard',
      },
      showToast: false,
    });
    expect(result.enabled).toBe(false);
    expect(result.preset).toBe('Custom');
    expect(result.options.format).toBe('plain');
    expect(result.options.links).toBe('keep');
    expect(result.options.removeTracking).toBe(false);
    expect(result.options.normalizeWhitespace).toBe(true);
    expect(result.showToast).toBe(false);
    expect(result.options).not.toHaveProperty('other');
  });
  it('returns independent defaults to avoid cross-context mutation', () => {
    const result = parseSettings(null);
    result.options.removeTracking = false;
    expect(DEFAULT_SETTINGS.options.removeTracking).toBe(true);
  });
  it('validates selection messages without trusting unknown data', () => {
    expect(
      parseSelection({
        text: 'A',
        html: '<p>A</p>',
        baseUrl: 'https://example.com',
        unexpected: 'ignored',
      }),
    ).toEqual({ text: 'A', html: '<p>A</p>', baseUrl: 'https://example.com' });
    expect(parseSelection({ text: 2 })).toBeNull();
    expect(parseSelection({ text: 'x'.repeat(500_001) })).toBeNull();
    expect(parseSelection({ text: 'A', html: 'x'.repeat(500_001) })).toBeNull();
  });
});
