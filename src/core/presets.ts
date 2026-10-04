import type { CleanOptions } from './types';
const defaults: CleanOptions = {
  format: 'plain', removeTracking: true, removeInvisible: true, normalizeWhitespace: true,
  preserveParagraphs: true, preserveHeadings: true, preserveLists: true, links: 'keep',
  smartQuotes: false, removeCitations: true,
};
export const PRESETS = {
  Plain: { ...defaults, format: 'plain' },
  Markdown: { ...defaults, format: 'markdown' },
  Writing: { ...defaults, links: 'remove', smartQuotes: true },
  Developer: { ...defaults, format: 'markdown', normalizeWhitespace: false, smartQuotes: true, removeInvisible: false, removeCitations: false },
} satisfies Record<string, CleanOptions>;
export type PresetName = keyof typeof PRESETS;
export const OPTION_LABELS: Record<Exclude<keyof CleanOptions, 'format' | 'links'>, string> = {
  removeTracking: 'Strip tracking parameters', removeInvisible: 'Remove invisible characters',
  normalizeWhitespace: 'Normalize whitespace', preserveParagraphs: 'Preserve paragraphs',
  preserveHeadings: 'Preserve headings', preserveLists: 'Preserve lists',
  smartQuotes: 'Use straight quotes', removeCitations: 'Remove chat citation artifacts',
};
