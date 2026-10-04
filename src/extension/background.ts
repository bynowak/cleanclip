import {
  extensionApi,
  readSettings,
  saveSettings,
  SITE_ORIGINS,
  watchSettings,
} from '../platform/browser';
const api = extensionApi();
if (!api) throw new Error('CleanClip requires an extension runtime.');
const SCRIPT_ID = 'cleanclip-auto';
let queue: Promise<void> = Promise.resolve();
function reconcile(): Promise<void> {
  queue = queue
    .catch(() => {})
    .then(async () => {
      const settings = await readSettings();
      const allowed = await api!.permissions.contains({ origins: SITE_ORIGINS });
      if (settings.enabled && !allowed) await saveSettings({ ...settings, enabled: false });
      const active = settings.enabled && allowed;
      const scripts = await api!.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
      if (active && scripts.length === 0)
        await api!.scripting.registerContentScripts([
          {
            id: SCRIPT_ID,
            matches: SITE_ORIGINS,
            js: ['content.js'],
            allFrames: true,
            runAt: 'document_start',
            persistAcrossSessions: true,
          },
        ]);
      if (!active && scripts.length > 0)
        await api!.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
      await api!.action.setBadgeText({ text: active ? 'ON' : '' });
      await api!.action.setBadgeBackgroundColor({ color: '#183d33' });
      await api!.action.setTitle({
        title: active ? 'CleanClip · automatic cleaning on' : 'CleanClip · automatic cleaning off',
      });
    });
  return queue;
}
const refresh = (): void => {
  void reconcile().catch(() => {
    void api.action.setBadgeText({ text: '!' });
  });
};
api.runtime.onInstalled.addListener(refresh);
api.runtime.onStartup.addListener(refresh);
api.permissions.onRemoved.addListener(refresh);
watchSettings(refresh);
api.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (
    sender.id !== api.runtime.id ||
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== 'reconcile'
  )
    return false;
  void reconcile()
    .then(() => respond({ ok: true }))
    .catch(() => respond({ ok: false }));
  return true;
});
api.commands.onCommand.addListener((command) => {
  if (command !== 'clean-selection') return;
  void (async () => {
    const tab = (await api.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab?.id) return;
    await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await api.tabs.sendMessage(tab.id, { type: 'clean-selection' });
  })().catch(() => {
    void api.action.setBadgeText({ text: '!' });
    void api.action.setTitle({
      title: 'CleanClip · page is restricted; use the toolbar to paste text',
    });
  });
});
