import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve('test-results');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(output, 'chromium-'));
assert(profile.startsWith(output + sep + 'chromium-'), 'Profile must stay within test-results');
const extensionPath = resolve('dist');
const errors = [];
const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(
    '<!doctype html><html lang="en"><head><title>CleanClip test article</title></head><body><article id="article"><h1>Fixture article</h1><p>A <strong>useful</strong> paragraph.</p><ul><li>One</li><li><a href="https://example.com/guide?utm_source=test&amp;page=2">A link</a></li></ul></article><textarea id="paste" aria-label="Paste target"></textarea><input type="password" value="private" aria-label="Password"></body></html>',
  );
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Fixture server did not start');
const origin = `http://127.0.0.1:${address.port}`;
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: process.env.CLEANCLIP_CHROME_CHANNEL ?? 'chromium',
    ignoreDefaultArgs: ['--disable-extensions'],
    ...(process.env.CLEANCLIP_CHROMIUM_PATH
      ? { executablePath: process.env.CLEANCLIP_CHROMIUM_PATH }
      : {}),
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: ['--enable-unsafe-extension-debugging'],
  });
  {
    const session = await context.browser().newBrowserCDPSession();
    const installed = await session.send('Extensions.loadUnpacked', { path: extensionPath });
    console.log('Loaded unpacked extension:', installed.id);
    console.log(JSON.stringify(await session.send('Extensions.getExtensions')));
    const wake = await context.newPage();
    await wake.goto(`chrome-extension://${installed.id}/popup.html`);
    await wake.evaluate(() => chrome.runtime.sendMessage({ type: 'reconcile' }));
    await wake.close();
    await session.detach();
  }
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).hostname;
  assert.equal(worker.url(), `chrome-extension://${extensionId}/background.js`);
  const popup = await context.newPage();
  popup.on('pageerror', (error) => errors.push(error.message));
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Plain', exact: true }).waitFor();
  assert.equal(
    await popup.getByRole('switch', { name: 'Automatic cleaning' }).getAttribute('aria-checked'),
    'false',
  );
  await popup.getByRole('button', { name: 'Try sample' }).click();
  await popup.getByRole('button', { name: 'Markdown', exact: true }).click();
  await popup.waitForFunction(() =>
    document
      .querySelector('textarea[aria-label="Cleaned output"]')
      .value.includes('## A cleaner copy'),
  );
  const markdown = await popup.getByRole('textbox', { name: 'Cleaned output' }).inputValue();
  assert(markdown.includes('[A useful link](<https://example.com/guide?page=2>)'));
  assert(!markdown.includes('utm_source'));
  await popup.getByRole('button', { name: 'Copy cleaned text' }).click();
  await popup.getByRole('status').filter({ hasText: 'Copied as markdown.' }).waitFor();
  await mkdir('docs/screenshots', { recursive: true });
  await popup.locator('main').screenshot({ path: 'docs/screenshots/popup.png' });
  const fixture = await context.newPage();
  fixture.on('pageerror', (error) => errors.push(error.message));
  await fixture.goto(origin);
  await fixture.getByRole('textbox', { name: 'Paste target' }).focus();
  await fixture.keyboard.press('Control+V');
  assert.equal(await fixture.getByRole('textbox', { name: 'Paste target' }).inputValue(), markdown);
  await fixture.evaluate(() => {
    document.activeElement?.blur();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('article'));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const fixtureSession = await context.newCDPSession(fixture);
  const target = await fixtureSession.send('Target.getTargetInfo');
  const browserSession = await context.browser().newBrowserCDPSession();
  const targets = await browserSession.send('Target.getTargets', {
    filter: [{ type: 'tab' }, { exclude: true }],
  });
  const tabTarget = targets.targetInfos.find((item) => item.url === fixture.url());
  console.log('Fixture tab target:', tabTarget?.type ?? target.targetInfo.type);
  await browserSession.send('Extensions.triggerAction', {
    id: extensionId,
    targetId: tabTarget?.targetId ?? target.targetInfo.targetId,
  });
  await fixtureSession.detach();
  await browserSession.detach();
  await fixture.bringToFront();
  const injected = await worker.evaluate(async (tabUrl) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === tabUrl + '/');
    // URL is only exposed with granted site access; use the active tab ID instead.
    const active = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    await chrome.scripting.executeScript({ target: { tabId: active.id }, files: ['content.js'] });
    return active.id;
  }, origin);
  const copied = await worker.evaluate(
    async (tabId) => chrome.tabs.sendMessage(tabId, { type: 'clean-selection' }),
    injected,
  );
  assert.equal(copied.ok, true, 'Explicit selection copy failed');
  await fixture.getByRole('textbox', { name: 'Paste target' }).fill('');
  await fixture.keyboard.press('Control+V');
  const selectionMarkdown = await fixture
    .getByRole('textbox', { name: 'Paste target' })
    .inputValue();
  assert(selectionMarkdown.includes('# Fixture article'));
  assert(selectionMarkdown.includes('**useful**'));
  assert(!selectionMarkdown.includes('utm_source'));
  await popup.bringToFront();
  await popup.getByRole('combobox', { name: 'Output format' }).selectOption('rich');
  await popup.getByRole('button', { name: 'Copy cleaned text' }).click();
  await popup.getByRole('status').filter({ hasText: 'Copied as clean rich text.' }).waitFor();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await fixture.bringToFront();
  const richClipboard = await fixture.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return (await items[0].getType('text/html')).text();
  });
  assert(richClipboard.includes('<strong>structure</strong>'));
  assert(!richClipboard.includes('utm_source'));
  assert(!richClipboard.includes('style='));
  const options = await context.newPage();
  options.on('pageerror', (error) => errors.push(error.message));
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByRole('button', { name: 'Writing', exact: true }).click();
  await options.getByRole('button', { name: 'Try sample' }).click();
  await options.waitForFunction(() =>
    document
      .querySelector('textarea[aria-label="Cleaned output"]')
      .value.includes('"Ready to paste."'),
  );
  await options.screenshot({ path: 'docs/screenshots/settings.png', fullPage: true });
  await options
    .locator('.preview-section')
    .screenshot({ path: 'docs/screenshots/writing-preview.png' });
  await options.reload();
  await options.getByRole('button', { name: 'Writing', exact: true }).waitFor();
  await options.waitForFunction(
    () => document.querySelector('button[aria-pressed="true"]').textContent === 'Writing',
  );
  assert.equal(
    await options.getByRole('textbox', { name: 'Input text' }).inputValue(),
    '',
    'Clipboard text must not persist',
  );
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  assert(commands.some((command) => command.name === 'clean-selection'));
  // Native permission prompts need a human. A disposable fixture manifest grants
  // sites up front so this test can exercise real automatic copy events headlessly.
  // The production manifest remains unchanged and was loaded/checked above.
  const fixtureExtension = resolve(profile, 'auto-fixture');
  await cp(extensionPath, fixtureExtension, { recursive: true });
  const fixtureManifest = JSON.parse(
    await readFile(resolve(fixtureExtension, 'manifest.json'), 'utf8'),
  );
  fixtureManifest.host_permissions = ['http://*/*', 'https://*/*'];
  await writeFile(resolve(fixtureExtension, 'manifest.json'), JSON.stringify(fixtureManifest));
  const autoSession = await context.browser().newBrowserCDPSession();
  const autoInstalled = await autoSession.send('Extensions.loadUnpacked', {
    path: fixtureExtension,
  });
  const autoPage = await context.newPage();
  await autoPage.goto(`chrome-extension://${autoInstalled.id}/options.html`);
  await autoPage.getByRole('button', { name: 'Markdown', exact: true }).click();
  await autoPage.evaluate(async () => {
    const stored = await chrome.storage.local.get('cleanclip.settings');
    await chrome.storage.local.set({
      'cleanclip.settings': { ...stored['cleanclip.settings'], enabled: true },
    });
    await chrome.runtime.sendMessage({ type: 'reconcile' });
  });
  await fixture.bringToFront();
  await fixture.reload();
  await fixture.waitForFunction(() => document.readyState === 'complete');
  // Wait for the content script's async settings cache without fixed sleeps.
  const autoWorker = context.serviceWorkers().find((item) => item.url().includes(autoInstalled.id));
  assert(autoWorker);
  await autoWorker.evaluate(() =>
    chrome.storage.local.set({
      'cleanclip.settings': {
        version: 1,
        enabled: true,
        preset: 'Markdown',
        showToast: true,
        options: {
          format: 'markdown',
          removeTracking: true,
          removeInvisible: true,
          normalizeWhitespace: true,
          preserveParagraphs: true,
          preserveHeadings: true,
          preserveLists: true,
          links: 'keep',
          smartQuotes: false,
          removeCitations: true,
        },
      },
    }),
  );
  const selectArticle = async () =>
    fixture.evaluate(() => {
      document.activeElement?.blur();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('article'));
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  await selectArticle();
  await fixture.keyboard.press('Control+C');
  await fixture.getByRole('textbox', { name: 'Paste target' }).focus();
  await fixture.keyboard.press('Control+V');
  const autoText = await fixture.getByRole('textbox', { name: 'Paste target' }).inputValue();
  assert(autoText.includes('# Fixture article'), 'Automatic copy did not preserve headings');
  assert(!autoText.includes('utm_source'));
  await autoPage.bringToFront();
  await autoPage.getByRole('switch', { name: 'Automatic cleaning' }).click();
  await autoPage.getByRole('status').filter({ hasText: 'disabled' }).waitFor();
  await fixture.bringToFront();
  await selectArticle();
  await fixture.keyboard.press('Control+C');
  const ordinary = await fixture.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return (await items[0].getType('text/html')).text();
  });
  assert(ordinary.includes('utm_source'), 'Disabled automatic cleaning still changed copied HTML');
  await autoSession.detach();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: production MV3 loaded unpacked; popup, clipboard, selection copy, rich payload, settings, no clipboard history, registered commands; automatic copy on/off verified with a separate permission fixture; no runtime errors.',
  );
} finally {
  await context?.close();
  await new Promise((done) => server.close(done));
  await rm(profile, { recursive: true, force: true });
}
