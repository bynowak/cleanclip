import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';
const files = {};
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else
      files[relative('dist', file).replaceAll('\\', '/')] = [
        new Uint8Array(await readFile(file)),
        { mtime: new Date(2026, 0, 1, 0, 0, 0) },
      ];
  }
}
await collect('dist');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
if (manifest.manifest_version !== 3 || !files['content.js'] || !files['background.js'])
  throw new Error('Build is incomplete.');
await mkdir('artifacts', { recursive: true });
const file = `artifacts/cleanclip-${manifest.version}-chromium.zip`;
await writeFile(file, zipSync(files, { level: 9 }));
console.log(`Packaged ${Object.keys(files).length} build files: ${file}`);
