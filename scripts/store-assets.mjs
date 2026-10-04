import sharp from 'sharp';
import { cp, mkdir } from 'node:fs/promises';
await mkdir('docs/store', { recursive: true });
const svg = (width, height, content) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f5f6f2"/>${content}</svg>`,
  );
const text = (x, y, size, words, color = '#183d33', weight = 500) =>
  `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}" font-weight="${weight}">${words}</text>`;
await cp('public/icons/128.png', 'docs/store/icon-128.png');
await sharp(
  svg(
    440,
    280,
    text(32, 66, 32, 'cleanclip.', '#183d33', 700) +
      text(32, 118, 28, 'Copy with clarity.') +
      text(32, 163, 15, 'Plain text · Markdown · Rich text', '#626e67') +
      '<path d="M32 191h376" stroke="#dce1d8"/>' +
      text(32, 227, 13, 'Local only. No analytics. Open source.', '#626e67'),
  ),
)
  .png()
  .toFile('docs/store/promo-440x280.png');
async function screenshot(source, name, title, subtitle, note) {
  const ui = await sharp(source)
    .resize({ width: 480, height: 690, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const metadata = await sharp(ui).metadata();
  const background = svg(
    1280,
    800,
    text(80, 96, 32, 'cleanclip.', '#183d33', 700) +
      text(80, 275, 48, title[0], '#183d33', 700) +
      text(80, 335, 48, title[1], '#183d33', 700) +
      text(80, 410, 22, subtitle, '#626e67') +
      text(80, 490, 16, 'Local only · No analytics · No clipboard history', '#626e67') +
      text(80, 690, 14, note, '#626e67'),
  );
  await sharp(background)
    .composite([
      {
        input: ui,
        left: 1280 - (metadata.width ?? 0) - 72,
        top: Math.round((800 - (metadata.height ?? 0)) / 2),
      },
    ])
    .png()
    .toFile(`docs/store/${name}`);
}
await screenshot(
  'docs/screenshots/popup.png',
  'screenshot-1-1280x800.png',
  ['Copy without', 'the cleanup.'],
  'Plain text. Markdown. Clean rich text.',
  'Actual extension UI · Built-in sample · Markdown preset',
);
await screenshot(
  'docs/screenshots/writing-preview.png',
  'screenshot-2-1280x800.png',
  ['Keep the shape.', 'Drop the clutter.'],
  'Preview your copy before you paste.',
  'Actual extension UI · Built-in sample · Writing preset',
);
console.log('Generated store icon, promotional tile and two 1280×800 screenshots.');
