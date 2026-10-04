import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/platform/settings';
import {
  getPageSelection,
  readSettings,
  revokeWebsiteAccess,
  saveSettings,
  setAutomatic,
  SITE_ORIGINS,
  STORAGE_KEY,
  writeClipboard,
} from '../src/platform/browser';
function mockApi() {
  return {
    runtime: { id: 'cleanclip-test', sendMessage: vi.fn().mockResolvedValue({ ok: true }) },
    storage: {
      local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
    },
    permissions: {
      request: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
    },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 7 }]),
      sendMessage: vi.fn().mockResolvedValue({ text: 'Selected', html: '<p>Selected</p>' }),
    },
    scripting: { executeScript: vi.fn().mockResolvedValue([]) },
  };
}
describe('browser adapter boundaries', () => {
  let api: ReturnType<typeof mockApi>;
  beforeEach(() => {
    api = mockApi();
    vi.stubGlobal('chrome', api);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('starts website permission request before any storage write', async () => {
    const result = await setAutomatic(true, DEFAULT_SETTINGS);
    expect(api.permissions.request).toHaveBeenCalledWith({ origins: SITE_ORIGINS });
    expect(api.permissions.request.mock.invocationCallOrder[0]).toBeLessThan(
      api.storage.local.set.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(result.enabled).toBe(true);
    expect(api.runtime.sendMessage).toHaveBeenCalledWith({ type: 'reconcile' });
  });
  it('does not enable or store anything after permission denial', async () => {
    api.permissions.request.mockResolvedValue(false);
    await expect(setAutomatic(true, DEFAULT_SETTINGS)).rejects.toThrow('declined');
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });
  it('disables without asking for permissions again', async () => {
    expect((await setAutomatic(false, { ...DEFAULT_SETTINGS, enabled: true })).enabled).toBe(false);
    expect(api.permissions.request).not.toHaveBeenCalled();
  });
  it('disables before revoking access', async () => {
    await revokeWebsiteAccess({ ...DEFAULT_SETTINGS, enabled: true });
    expect(api.storage.local.set.mock.invocationCallOrder[0]).toBeLessThan(
      api.permissions.remove.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(api.permissions.remove).toHaveBeenCalledWith({ origins: SITE_ORIGINS });
  });
  it('stores only validated preferences, without clipboard content', async () => {
    await saveSettings(DEFAULT_SETTINGS);
    expect(api.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    expect(await readSettings()).toEqual(DEFAULT_SETTINGS);
  });
  it('loads a selection through active-tab injection', async () => {
    expect(await getPageSelection()).toEqual({ text: 'Selected', html: '<p>Selected</p>' });
    expect(api.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content.js'],
    });
  });
  it('gives a useful error for browser-protected pages', async () => {
    api.scripting.executeScript.mockRejectedValue(new Error('permission error'));
    await expect(getPageSelection()).rejects.toThrow('page cannot be accessed');
  });
  it('writes plain text only when no HTML is returned', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await writeClipboard({ text: 'Clean', html: null, warnings: [] });
    expect(writeText).toHaveBeenCalledWith('Clean');
  });
  it('refuses a rich-to-plain silent downgrade', async () => {
    vi.stubGlobal('navigator', { clipboard: {} });
    vi.stubGlobal('ClipboardItem', undefined);
    await expect(
      writeClipboard({ text: 'Clean', html: '<p>Clean</p>', warnings: [] }),
    ).rejects.toThrow('does not support rich');
  });
});
