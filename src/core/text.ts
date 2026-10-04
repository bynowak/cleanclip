import type { CleanOptions } from './types';
const TRACKING =
  /^(?:utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|mkt_tok|vero_id)$/i;
export function cleanUrl(value: string, removeTracking: boolean, baseUrl?: string): string | null {
  const stripped = Array.from(value)
    .filter((character) => character.charCodeAt(0) > 32 && character.charCodeAt(0) !== 127)
    .join('');
  try {
    const url = new URL(stripped, baseUrl);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (removeTracking && ['http:', 'https:'].includes(url.protocol)) {
      for (const key of [...url.searchParams.keys()])
        if (TRACKING.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
}
export function cleanText(value: string, options: CleanOptions, code = false): string {
  let text = value.replace(/\r\n?/g, '\n');
  if (options.removeInvisible) {
    // Keep ZWJ/ZWNJ, variation selectors and emoji tag sequences: they encode real language/emoji.
    text = text.replace(/[\u00ad\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '');
  }
  if (options.removeCitations && !code) {
    text = text
      .replace(/\uE200(?:cite|filecite|file)\uE202[^\uE201]*\uE201/g, '')
      .replace(/\uE200[^\uE201]*\uE201/g, '')
      .replace(/【\d+(?::\d+)?†[^】\n]*】/g, '');
  }
  if (options.smartQuotes && !code) text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (options.normalizeWhitespace && !code) {
    text = text
      .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n');
  }
  return text;
}
export function normalizeLines(value: string, options: CleanOptions): string {
  let text = value;
  if (options.normalizeWhitespace) text = text.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  if (!options.preserveParagraphs) text = text.replace(/\n{2,}/g, '\n');
  return options.normalizeWhitespace ? text.trim() : text;
}
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
