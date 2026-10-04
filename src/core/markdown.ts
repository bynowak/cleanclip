import type { CleanOptions } from './types';
import { cleanUrl } from './text';

function closing(source: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    if (source[index] === '\\') {
      index++;
      continue;
    }
    if (source[index] === open) depth++;
    if (source[index] === close && --depth === 0) return index;
  }
  return -1;
}
export function cleanMarkdownLinks(source: string, options: CleanOptions): string {
  let output = '';
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\\') {
      output += source.slice(index, index + 2);
      index++;
      continue;
    }
    if (source[index] !== '[' || source[index - 1] === '!') {
      output += source[index];
      continue;
    }
    const end = closing(source, index, '[', ']');
    if (end < 0 || source[end + 1] !== '(') {
      output += source[index];
      continue;
    }
    const destinationEnd = closing(source, end + 1, '(', ')');
    if (destinationEnd < 0) {
      output += source[index];
      continue;
    }
    const label = source.slice(index + 1, end);
    const destination = source.slice(end + 2, destinationEnd).trim();
    const match = /^(?:<([^>]+)>|([^\s]+))(?:\s+(["'])(.*?)\3)?$/.exec(destination);
    const url = match ? cleanUrl(match[1] ?? match[2] ?? '', options.removeTracking) : null;
    output +=
      options.links === 'remove' || !url
        ? label
        : `[${label}](<${url}>${match?.[4] ? ` "${match[4].replace(/"/g, '&quot;')}"` : ''})`;
    index = destinationEnd;
  }
  return output;
}
