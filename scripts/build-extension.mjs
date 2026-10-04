import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="30" fill="#183d33"/><path d="M40 29v43c0 10 8 18 18 18h29M72 75l16 15-16 15" fill="none" stroke="#e3eddd" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 32h28M66 47h20" stroke="#9eb48f" stroke-width="7" stroke-linecap="round"/></svg>`;
await mkdir('public/icons', { recursive: true });
await mkdir('dist/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`public/icons/${size}.png`);
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`dist/icons/${size}.png`);
}
await writeFile('public/icons/mark.svg', icon + '\n');
for (const name of ['background', 'content']) {
  await build({
    configFile: false,
    publicDir: false,
    build: {
      target: 'chrome120',
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: `src/extension/${name}.ts`,
        formats: [name === 'content' ? 'iife' : 'es'],
        name: 'CleanClip',
        fileName: () => `${name}.js`,
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
}
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== version) throw new Error('Manifest and package version must match.');
console.log(`CleanClip ${version} built in dist/ — load this directory unpacked.`);
