import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import { cleanMarkdownLinks } from './markdown';
import { cleanText, cleanUrl, escapeHtml, normalizeLines } from './text';
import { MAX_INPUT_LENGTH, type CleanOptions, type CleanResult, type ClipInput } from './types';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
type Mode = 'plain' | 'markdown' | 'rich';
const BLOCKS = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'figure',
  'figcaption',
  'address',
  'dl',
  'dt',
  'dd',
]);
const OMIT = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'input',
  'button',
  'select',
  'textarea',
]);
const children = (node: Node): Node[] => ('childNodes' in node ? node.childNodes : []);
const isElement = (node: Node): node is Element => 'tagName' in node;
const attr = (node: Element, name: string): string | undefined =>
  node.attrs.find((item) => item.name === name)?.value;
const rawText = (node: Node): string =>
  'value' in node ? node.value : children(node).map(rawText).join('');
const markdownEscape = (value: string): string =>
  value.replace(/([\\`*_[\]<>])/g, '\\$1').replace(/(^|\n)([>#]|\d+\.)/g, '$1\\$2');

class Renderer {
  private codeBlocks: string[] = [];
  private tokenBase = '\uE000CLEANCLIP';
  constructor(
    private options: CleanOptions,
    private mode: Mode,
    private baseUrl: string | undefined,
    private warnings: Set<string>,
    source: string,
  ) {
    while (source.includes(this.tokenBase)) this.tokenBase += '_';
  }
  private preserveCode(value: string): string {
    const token = `${this.tokenBase}${this.codeBlocks.length}\uE001`;
    this.codeBlocks.push(value);
    return token;
  }
  finish(value: string): string {
    if (this.mode === 'rich') return value;
    let text = normalizeLines(value, this.options).trim();
    this.codeBlocks.forEach((code, index) => {
      text = text.replace(`${this.tokenBase}${index}\uE001`, code);
    });
    return text;
  }
  render(node: Node, depth = 0): string {
    if ('value' in node) {
      const text = cleanText(node.value, this.options);
      return this.mode === 'rich'
        ? escapeHtml(text)
        : this.mode === 'markdown'
          ? markdownEscape(text)
          : text;
    }
    if (!isElement(node))
      return children(node)
        .map((child) => this.render(child, depth))
        .join('');
    const tag = node.tagName;
    if (
      OMIT.has(tag) ||
      attr(node, 'hidden') !== undefined ||
      attr(node, 'aria-hidden') === 'true' ||
      /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(node, 'style') ?? '')
    )
      return '';
    const inside = (): string =>
      children(node)
        .map((child) => this.render(child, depth))
        .join('');
    const block = (text: string, name = 'p'): string =>
      this.mode === 'rich'
        ? !this.options.preserveParagraphs && name === 'p'
          ? `${text}<br>`
          : `<${name}>${text}</${name}>`
        : `\n\n${text.trim()}\n\n`;
    if (tag === 'br') return this.mode === 'rich' ? '<br>' : '\n';
    if (tag === 'hr') return this.mode === 'rich' ? '<hr>' : '\n\n---\n\n';
    if (tag === 'img') {
      const alt = cleanText(attr(node, 'alt') ?? '', this.options);
      return this.mode === 'rich'
        ? escapeHtml(alt)
        : this.mode === 'markdown'
          ? markdownEscape(alt)
          : alt;
    }
    if (tag === 'pre') {
      const code = cleanText(rawText(node), this.options, true).replace(/^\n|\n$/g, '');
      if (this.mode === 'rich') return `<pre><code>${escapeHtml(code)}</code></pre>`;
      if (this.mode === 'plain') return `\n\n${this.preserveCode(code)}\n\n`;
      const fence = '`'.repeat(
        Math.max(3, ...[...code.matchAll(/`+/g)].map((match) => match[0].length + 1)),
      );
      return `\n\n${this.preserveCode(`${fence}\n${code}\n${fence}`)}\n\n`;
    }
    if (tag === 'code') {
      const code = cleanText(rawText(node), this.options, true);
      if (this.mode === 'rich') return `<code>${escapeHtml(code)}</code>`;
      if (this.mode === 'plain') return code;
      const delimiter = '`'.repeat(
        Math.max(1, ...[...code.matchAll(/`+/g)].map((match) => match[0].length + 1)),
      );
      const pad = /(^`|`$|^ | $)/.test(code) ? ' ' : '';
      return `${delimiter}${pad}${code}${pad}${delimiter}`;
    }
    if (tag === 'a') {
      const text = inside();
      const url = cleanUrl(attr(node, 'href') ?? '', this.options.removeTracking, this.baseUrl);
      if (this.options.links === 'remove' || !url) return text;
      if (this.mode === 'rich')
        return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${text || escapeHtml(url)}</a>`;
      if (this.mode === 'markdown') return `[${text || markdownEscape(url)}](<${url}>)`;
      return !text || text.trim() === url ? url : `${text} (${url})`;
    }
    if (/^h[1-6]$/.test(tag)) {
      const text = inside().trim();
      if (this.mode === 'rich') return block(text, this.options.preserveHeadings ? tag : 'p');
      return block(
        this.mode === 'markdown' && this.options.preserveHeadings
          ? `${'#'.repeat(Number(tag[1]))} ${text}`
          : text,
      );
    }
    if (tag === 'ul' || tag === 'ol') return this.list(node, depth);
    if (tag === 'table') return this.table(node);
    if (tag === 'blockquote') {
      const text = inside().trim();
      return this.mode === 'rich'
        ? `<blockquote>${text}</blockquote>`
        : block(
            this.mode === 'markdown'
              ? text
                  .split('\n')
                  .map((line) => `> ${line}`)
                  .join('\n')
              : text,
          );
    }
    if (['b', 'strong', 'i', 'em', 's', 'del'].includes(tag)) {
      const text = inside();
      const normalized = ['b', 'strong'].includes(tag)
        ? 'strong'
        : ['i', 'em'].includes(tag)
          ? 'em'
          : 'del';
      if (this.mode === 'rich') return `<${normalized}>${text}</${normalized}>`;
      const marker = normalized === 'strong' ? '**' : normalized === 'em' ? '*' : '~~';
      return this.mode === 'markdown' && text.trim() ? `${marker}${text.trim()}${marker}` : text;
    }
    if (BLOCKS.has(tag)) {
      const hasBlocks = children(node).some(
        (child) =>
          isElement(child) &&
          (BLOCKS.has(child.tagName) ||
            /^(?:h[1-6]|ul|ol|pre|table|blockquote)$/.test(child.tagName)),
      );
      return hasBlocks ? inside() : block(inside());
    }
    return inside();
  }
  private list(node: Element, depth: number): string {
    const ordered = node.tagName === 'ol';
    const parsedStart = Number(attr(node, 'start') ?? 1);
    let number = Number.isSafeInteger(parsedStart) && parsedStart >= 0 ? parsedStart : 1;
    const items = children(node).filter(
      (child): child is Element => isElement(child) && child.tagName === 'li',
    );
    if (this.mode === 'rich') {
      const body = items
        .map((item) => {
          const text = children(item)
            .map((child) => this.render(child, depth + 1))
            .join('');
          return this.options.preserveLists ? `<li>${text}</li>` : `${text}<br>`;
        })
        .join('');
      return this.options.preserveLists
        ? `<${node.tagName}${ordered && number !== 1 ? ` start="${number}"` : ''}>${body}</${node.tagName}>`
        : body;
    }
    const lines = items
      .map((item) => {
        const own = children(item)
          .filter((child) => !(isElement(child) && ['ul', 'ol'].includes(child.tagName)))
          .map((child) => this.render(child, depth + 1))
          .join('')
          .trim();
        const nested = children(item)
          .filter((child) => isElement(child) && ['ul', 'ol'].includes(child.tagName))
          .map((child) => this.render(child, depth + 1).trimEnd())
          .join('\n');
        const marker = this.options.preserveLists ? (ordered ? `${number++}. ` : '- ') : '';
        const indent = this.options.preserveLists ? '    '.repeat(depth) : '';
        const text = own
          .split('\n')
          .map((line, index) => indent + (index === 0 ? marker : ' '.repeat(marker.length)) + line)
          .join('\n');
        return text + (nested ? '\n' + nested : '');
      })
      .join('\n');
    return depth === 0 ? `\n\n${lines}\n\n` : lines + '\n';
  }
  private table(node: Element): string {
    const rows: Element[][] = [];
    const visit = (element: Element): void => {
      if (element !== node && element.tagName === 'table') return;
      if (element.tagName === 'tr')
        rows.push(
          children(element).filter(
            (child): child is Element => isElement(child) && ['td', 'th'].includes(child.tagName),
          ),
        );
      else children(element).filter(isElement).forEach(visit);
    };
    visit(node);
    if (rows.length === 0) return '';
    if (rows.flat().some((cell) => attr(cell, 'colspan') || attr(cell, 'rowspan')))
      this.warnings.add('Merged table cells are flattened; verify column alignment.');
    const cells = rows.map((row) =>
      row.map((cell) =>
        children(cell)
          .map((child) => this.render(child))
          .join('')
          .trim(),
      ),
    );
    if (this.mode === 'rich')
      return `<table><tbody>${cells
        .map(
          (row, index) =>
            `<tr>${row
              .map((text, column) => {
                const name = rows[index]?.[column]?.tagName ?? 'td';
                return `<${name}>${text}</${name}>`;
              })
              .join('')}</tr>`,
        )
        .join('')}</tbody></table>`;
    if (this.mode === 'plain') return `\n\n${cells.map((row) => row.join('\t')).join('\n')}\n\n`;
    const width = Math.max(...cells.map((row) => row.length));
    const line = (row: string[]): string =>
      `| ${Array.from({ length: width }, (_, index) => (row[index] ?? '').replace(/\|/g, '\\|').replace(/\n+/g, '<br>')).join(' | ')} |`;
    const hasHeader = rows[0]?.every((cell) => cell.tagName === 'th') ?? false;
    const header = hasHeader ? (cells.shift() ?? []) : Array<string>(width).fill('');
    return `\n\n${[line(header), line(Array<string>(width).fill('---')), ...cells.map(line)].join('\n')}\n\n`;
  }
}

function validateTree(node: Node, depth = 0, budget = { nodes: 0 }): void {
  if (depth > 128 || ++budget.nodes > 50_000)
    throw new RangeError(
      'This HTML is too complex to clean safely. Try copying a smaller selection.',
    );
  children(node).forEach((child) => validateTree(child, depth + 1, budget));
}

function cleanPlainSource(source: string, options: CleanOptions): string {
  // Fenced and inline code bypass prose edits; whitespace can be syntax in code.
  const segments = source.split(/(`{3,}[^\n]*\n[\s\S]*?\n`{3,}|`+[^`\n]+`+)/g);
  const protectedCode: string[] = [];
  let tokenBase = '\uE000PLAINCODE';
  while (source.includes(tokenBase)) tokenBase += '_';
  const result = segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        protectedCode.push(cleanText(segment, options, true));
        return `${tokenBase}${protectedCode.length - 1}\uE001`;
      }
      let text = cleanMarkdownLinks(cleanText(segment, options), options);
      text = text.replace(/https?:\/\/[^\s<>]+/g, (original) => {
        let candidate = original;
        let suffix = '';
        while (
          /[.,;!?]$/.test(candidate) ||
          (candidate.endsWith(')') &&
            (candidate.match(/\)/g)?.length ?? 0) > (candidate.match(/\(/g)?.length ?? 0))
        ) {
          suffix = candidate.slice(-1) + suffix;
          candidate = candidate.slice(0, -1);
        }
        return (cleanUrl(candidate, options.removeTracking) ?? candidate) + suffix;
      });
      if (!options.preserveHeadings) text = text.replace(/^ {0,3}#{1,6}\s+/gm, '');
      if (!options.preserveLists) text = text.replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, '');
      return text;
    })
    .join('');
  let text = normalizeLines(result, options);
  protectedCode.forEach((code, index) => {
    text = text.replace(`${tokenBase}${index}\uE001`, code);
  });
  return text;
}

export function transform(input: ClipInput, options: CleanOptions): CleanResult {
  if (input.text.length > MAX_INPUT_LENGTH || (input.html?.length ?? 0) > MAX_INPUT_LENGTH)
    throw new RangeError('Selection is too large. Clean up to 500,000 characters at a time.');
  const warnings = new Set<string>();
  if (input.html?.trim()) {
    const tree = parseFragment(input.html);
    validateTree(tree);
    const source = rawText(tree);
    const textRenderer = new Renderer(
      options,
      options.format === 'markdown' ? 'markdown' : 'plain',
      input.baseUrl,
      warnings,
      source,
    );
    const text = textRenderer.finish(textRenderer.render(tree));
    if (text || !input.text.trim()) {
      const rich = new Renderer(options, 'rich', input.baseUrl, warnings, source);
      return {
        text,
        html: options.format === 'rich' ? rich.render(tree) : null,
        warnings: [...warnings],
      };
    }
    warnings.add('HTML contained no readable text; plain text was used.');
  }
  const text = cleanPlainSource(input.text, options);
  const html =
    options.format === 'rich'
      ? text
          .split(/\n{2,}/)
          .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
          .join('')
      : null;
  return { text, html, warnings: [...warnings] };
}
