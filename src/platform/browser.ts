import { MAX_INPUT_LENGTH, type ClipInput, type CleanResult } from '../core';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from './settings';

// A single adapter owns Chromium access. Firefox's promise API can be wired here;
// its manifest/background and permission lifecycle still require separate testing.
export function extensionApi(): typeof chrome | undefined {
  const host = globalThis as typeof globalThis & { browser?: typeof chrome };
  const api = host.browser ?? host.chrome;
  return api?.runtime?.id ? api : undefined;
}
export const STORAGE_KEY = 'cleanclip.settings';
export const SITE_ORIGINS = ['https://*/*', 'http://*/*'];
export async function readSettings(): Promise<Settings> {
  const api = extensionApi();
  if (api) return parseSettings((await api.storage.local.get(STORAGE_KEY))[STORAGE_KEY]);
  try {
    return parseSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}
export async function saveSettings(settings: Settings): Promise<void> {
  const parsed = parseSettings(settings);
  const api = extensionApi();
  if (api) await api.storage.local.set({ [STORAGE_KEY]: parsed });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}
export async function setAutomatic(enabled: boolean, settings: Settings): Promise<Settings> {
  const api = extensionApi();
  if (!api) throw new Error('Automatic cleaning is available in the installed extension.');
  // Request must begin directly in the click handler to retain user activation.
  if (enabled && !(await api.permissions.request({ origins: SITE_ORIGINS })))
    throw new Error('Website access was declined. One-off cleaning still works.');
  const updated = { ...settings, enabled };
  await saveSettings(updated);
  await api.runtime.sendMessage({ type: 'reconcile' });
  return updated;
}
export function watchSettings(callback: (settings: Settings) => void): () => void {
  const api = extensionApi();
  if (!api) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === 'local' && changes[STORAGE_KEY])
      callback(parseSettings(changes[STORAGE_KEY].newValue));
  };
  api.storage.onChanged.addListener(listener);
  return () => api.storage.onChanged.removeListener(listener);
}
export function parseSelection(value: unknown): ClipInput | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('text' in value) ||
    typeof value.text !== 'string' ||
    value.text.length > MAX_INPUT_LENGTH
  )
    return null;
  if ('html' in value && typeof value.html === 'string' && value.html.length > MAX_INPUT_LENGTH)
    return null;
  return {
    text: value.text,
    ...('html' in value && typeof value.html === 'string' ? { html: value.html } : {}),
    ...('baseUrl' in value && typeof value.baseUrl === 'string' ? { baseUrl: value.baseUrl } : {}),
  };
}
export async function getPageSelection(): Promise<ClipInput> {
  const api = extensionApi();
  if (!api) throw new Error('Paste text below, or load CleanClip unpacked to use page selection.');
  const tab = (await api.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) throw new Error('No active website was found.');
  try {
    await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const selection = parseSelection(
      await api.tabs.sendMessage<unknown>(tab.id, { type: 'selection' }),
    );
    if (!selection?.text.trim()) throw new Error('Select some text on the page first.');
    return selection;
  } catch (error) {
    if (error instanceof Error && error.message === 'Select some text on the page first.')
      throw error;
    throw new Error(
      'This page cannot be accessed. Browser pages, the extension store and some viewers are restricted. Paste the text instead.',
      { cause: error },
    );
  }
}
export async function writeClipboard(result: CleanResult): Promise<void> {
  if (!navigator.clipboard) throw new Error('Clipboard access is unavailable in this context.');
  if (result.html !== null && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([result.text], { type: 'text/plain' }),
        'text/html': new Blob([result.html], { type: 'text/html' }),
      }),
    ]);
  } else if (result.html !== null)
    throw new Error(
      'This browser does not support rich clipboard writes. Choose Plain or Markdown.',
    );
  else await navigator.clipboard.writeText(result.text);
}
export async function openSettings(): Promise<void> {
  const api = extensionApi();
  if (api) await api.runtime.openOptionsPage();
  else location.href = './options.html';
}
export async function revokeWebsiteAccess(settings: Settings): Promise<Settings> {
  const api = extensionApi();
  if (!api) throw new Error('Website access can be managed in the installed extension.');
  const updated = { ...settings, enabled: false };
  await saveSettings(updated);
  await api.permissions.remove({ origins: SITE_ORIGINS });
  await api.runtime.sendMessage({ type: 'reconcile' });
  return updated;
}
