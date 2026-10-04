export type OutputFormat = 'plain' | 'markdown' | 'rich';
export type LinkMode = 'keep' | 'remove';
export interface CleanOptions {
  format: OutputFormat;
  removeTracking: boolean;
  removeInvisible: boolean;
  normalizeWhitespace: boolean;
  preserveParagraphs: boolean;
  preserveHeadings: boolean;
  preserveLists: boolean;
  links: LinkMode;
  smartQuotes: boolean;
  removeCitations: boolean;
}
export interface ClipInput {
  text: string;
  html?: string;
  baseUrl?: string;
}
export interface CleanResult {
  text: string;
  html: string | null;
  warnings: string[];
}
export const MAX_INPUT_LENGTH = 500_000;
