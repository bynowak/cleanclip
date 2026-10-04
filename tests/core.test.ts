import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { transform, PRESETS, cleanUrl, MAX_INPUT_LENGTH } from '../src/core';
const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
describe('prose cleaning', () => {
  it('normalizes Unicode spaces, line endings and repeated blank lines', () => {
    expect(
      transform({ text: '  First\u00a0  line\r\n\r\n\r\nSecond\tline  ' }, PRESETS.Plain).text,
    ).toBe('First line\n\nSecond line');
  });
  it('removes zero-width spaces, BOM, soft hyphens and bidi controls', () => {
    expect(transform({ text: '\ufeffco\u00adpy\u200b\u2060\u202etext' }, PRESETS.Plain).text).toBe(
      'copytext',
    );
  });
  it('preserves real emoji sequences and language joiners', () => {
    expect(transform({ text: '👩‍💻 فارسی\u200cنویس' }, PRESETS.Plain).text).toBe(
      '👩‍💻 فارسی\u200cنویس',
    );
  });
  it('converts smart quotes only when requested', () => {
    expect(transform({ text: '“It’s clear.”' }, PRESETS.Writing).text).toBe('"It\'s clear."');
    expect(transform({ text: '“It’s clear.”' }, PRESETS.Plain).text).toBe('“It’s clear.”');
  });
  it('removes identifiable chat citations while keeping ordinary scholarly references', () => {
    expect(
      transform(
        { text: 'Fact citeturn1search0 and 【12†source】 [1] (Smith, 2024).' },
        PRESETS.Plain,
      ).text,
    ).toBe('Fact and [1] (Smith, 2024).');
  });
  it('allows invisible characters and citation artifacts to remain', () => {
    const result = transform(
      { text: 'A\u200bB citeturn1' },
      { ...PRESETS.Plain, removeInvisible: false, removeCitations: false },
    );
    expect(result.text).toBe('A\u200bB citeturn1');
  });
  it('preserves paragraph boundaries or collapses them on request', () => {
    expect(
      transform({ text: 'A\n\nB' }, { ...PRESETS.Plain, preserveParagraphs: false }).text,
    ).toBe('A\nB');
  });
  it('does not collapse code indentation, quotes, or blank lines', () => {
    const input = 'Before `“quoted”` after\n\n```js\n  const s = “x”;\n\n\n  next();\n```\n\nDone';
    expect(transform({ text: input }, PRESETS.Writing).text).toBe(input);
  });
  it('rejects oversized input rather than silently truncating it', () => {
    expect(() => transform({ text: 'x'.repeat(MAX_INPUT_LENGTH + 1) }, PRESETS.Plain)).toThrow(
      'too large',
    );
  });
});
describe('URL and Markdown handling', () => {
  it('strips trackers while preserving functional query parameters and fragments', () => {
    expect(cleanUrl('https://example.com/a?UTM_source=x&fbclid=y&page=2#part', true)).toBe(
      'https://example.com/a?page=2#part',
    );
  });
  it('keeps tracking parameters when disabled', () => {
    expect(cleanUrl('https://example.com/?utm_source=x', false)).toBe(
      'https://example.com/?utm_source=x',
    );
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///etc/passwd',
    'https://user:secret@example.com',
    'jav\nascript:alert(1)',
  ])('rejects unsafe links: %s', (url) => {
    expect(cleanUrl(url, true)).toBeNull();
  });
  it('resolves relative links against the selection URL', () => {
    expect(cleanUrl('../guide?utm_medium=email', true, 'https://example.com/blog/post')).toBe(
      'https://example.com/guide',
    );
  });
  it('does not guess a host for relative links without context', () =>
    expect(cleanUrl('/guide', true)).toBeNull());
  it('cleans existing Markdown links with balanced brackets and parentheses', () => {
    expect(
      transform(
        { text: '[API [v2]](https://example.com/a(b)?utm_source=x "Docs")' },
        PRESETS.Markdown,
      ).text,
    ).toBe('[API [v2]](<https://example.com/a(b)> "Docs")');
  });
  it('removes links while retaining labels', () => {
    expect(
      transform({ text: 'Read [the guide](https://example.com/?utm_source=x).' }, PRESETS.Writing)
        .text,
    ).toBe('Read the guide.');
  });
  it('cleans bare URLs without swallowing sentence punctuation', () => {
    expect(
      transform({ text: 'Visit https://example.com/a(b)?utm_source=x.' }, PRESETS.Plain).text,
    ).toBe('Visit https://example.com/a(b).');
  });
  it('leaves URL examples in code untouched', () => {
    expect(transform({ text: '`https://example.com/?utm_source=x`' }, PRESETS.Markdown).text).toBe(
      '`https://example.com/?utm_source=x`',
    );
  });
});
describe('structured HTML', () => {
  it('preserves headings, nested lists and ordered start numbers in Markdown', () => {
    const result = transform({ text: '', html: fixture('article') }, PRESETS.Markdown);
    expect(result.text).toContain('# A better copy');
    expect(result.text).toContain('**useful structure**');
    expect(result.text).toContain('[useful links](<https://example.com/guide?topic=copy#tips>)');
    expect(result.text).toContain(
      '3. Read the article\n    - Check the examples\n        - Keep the details\n4. Copy the text',
    );
    expect(result.text).not.toContain('Hidden words');
    expect(result.text).not.toContain('alert');
  });
  it('preserves structure in plain text without formatting markers', () => {
    const result = transform({ text: '', html: fixture('article') }, PRESETS.Plain);
    expect(result.text).toContain('A better copy');
    expect(result.text).not.toContain('**');
    expect(result.text).toContain('3. Read the article');
  });
  it('removes headings and list markers when disabled', () => {
    const result = transform(
      { text: '', html: '<h2>Title</h2><ul><li>One</li><li>Two</li></ul>' },
      { ...PRESETS.Markdown, preserveHeadings: false, preserveLists: false },
    );
    expect(result.text).toBe('Title\n\nOne\nTwo');
  });
  it('escapes Markdown syntax that came from literal website text', () => {
    expect(
      transform({ text: '', html: '<p>*literal* [text] &lt;tag&gt;</p>' }, PRESETS.Markdown).text,
    ).toBe('\\*literal\\* \\[text\\] \\<tag\\>');
  });
  it('creates Markdown tables and escapes cell pipes', () => {
    const result = transform({ text: '', html: fixture('table') }, PRESETS.Markdown);
    expect(result.text).toContain('| Feature | State |\n| --- | --- |');
    expect(result.text).toContain('| Links \\| labels | **Kept** |');
    expect(result.text).toContain('Tracking<br>parameters');
  });
  it('does not falsely treat the first data row as a table header', () => {
    expect(
      transform(
        { text: '', html: '<table><tr><td>A</td><td>B</td></tr></table>' },
        PRESETS.Markdown,
      ).text,
    ).toBe('|  |  |\n| --- | --- |\n| A | B |');
  });
  it('warns about merged table cells', () => {
    expect(
      transform({ text: '', html: '<table><tr><td colspan="2">A</td></tr></table>' }, PRESETS.Plain)
        .warnings,
    ).toHaveLength(1);
  });
  it('uses tab-separated cells in plain text', () => {
    expect(
      transform({ text: '', html: '<table><tr><td>A</td><td>B</td></tr></table>' }, PRESETS.Plain)
        .text,
    ).toBe('A\tB');
  });
  it('sanitizes rich text without fonts, colors, event handlers or remote images', () => {
    const html =
      '<div style="color:red"><p onclick="evil()">A <b>B</b> <a href="javascript:evil()">link</a><img src="https://tracker.test/pixel" alt="Image"></p></div>';
    expect(transform({ text: '', html }, { ...PRESETS.Plain, format: 'rich' }).html).toBe(
      '<p>A <strong>B</strong> linkImage</p>',
    );
  });
  it('preserves safe semantic rich text and clean links', () => {
    const result = transform(
      {
        text: '',
        html: '<h2>Title</h2><p><a href="/page?utm_source=x">Page</a></p>',
        baseUrl: 'https://example.com',
      },
      { ...PRESETS.Markdown, format: 'rich' },
    );
    expect(result.html).toBe(
      '<h2>Title</h2><p><a href="https://example.com/page" rel="noopener noreferrer">Page</a></p>',
    );
    expect(result.text).toBe('Title\n\nPage (https://example.com/page)');
  });
  it('keeps code whitespace and picks a safe Markdown fence', () => {
    expect(
      transform({ text: '', html: '<pre>  x\n```\n\n\n  y</pre>' }, PRESETS.Markdown).text,
    ).toBe('````\n  x\n```\n\n\n  y\n````');
  });
  it('handles malformed fragments without executing them', () => {
    expect(transform({ text: '', html: '<p>A<p>B<b>C' }, PRESETS.Plain).text).toBe('A\n\nBC');
  });
  it('falls back to readable plain text when HTML is empty or unsafe', () => {
    const result = transform({ text: 'Readable', html: '<script>evil()</script>' }, PRESETS.Plain);
    expect(result.text).toBe('Readable');
    expect(result.warnings).toHaveLength(1);
  });
  it('rejects deeply nested HTML safely', () => {
    expect(() =>
      transform(
        { text: '', html: '<div>'.repeat(140) + 'A' + '</div>'.repeat(140) },
        PRESETS.Plain,
      ),
    ).toThrow('too complex');
  });
  it('is deterministic and does not mutate presets', () => {
    const input = { text: '', html: fixture('article') };
    const before = JSON.stringify(PRESETS);
    expect(transform(input, PRESETS.Markdown)).toEqual(transform(input, PRESETS.Markdown));
    expect(JSON.stringify(PRESETS)).toBe(before);
  });
});
