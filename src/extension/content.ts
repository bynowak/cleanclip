import { transform, MAX_INPUT_LENGTH, type ClipInput } from '../core';
import { extensionApi, readSettings, watchSettings } from '../platform/browser';
import { DEFAULT_SETTINGS } from '../platform/settings';

const host = globalThis as typeof globalThis & { __cleanclipInstalled?: boolean };
if (!host.__cleanclipInstalled) {
  host.__cleanclipInstalled = true;
  let settings = structuredClone(DEFAULT_SETTINGS);
  let force = false;
  let copied = false;
  let toastHost: HTMLElement | null = null;
  const load = (): void => {
    void readSettings()
      .then((value) => {
        settings = value;
      })
      .catch(() => {
        settings = structuredClone(DEFAULT_SETTINGS);
      });
  };
  load();
  watchSettings((value) => {
    settings = value;
  });
  function selection(): ClipInput {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      if (active instanceof HTMLInputElement && active.type === 'password') return { text: '' };
      return { text: active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? 0) };
    }
    const selected = window.getSelection();
    if (!selected || selected.isCollapsed) return { text: '' };
    const text = selected.toString();
    if (text.length > MAX_INPUT_LENGTH)
      throw new RangeError('Selection is too large. Copy a smaller section.');
    const container = document.createElement('div');
    for (let index = 0; index < selected.rangeCount; index++) {
      const range = selected.getRangeAt(index);
      const fragment = range.cloneContents();
      // A selection wholly inside a heading/pre loses its ancestor in cloneContents.
      const ancestor =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
      const semantic = ancestor?.closest('h1,h2,h3,h4,h5,h6,pre');
      if (
        semantic &&
        semantic.contains(range.startContainer) &&
        semantic.contains(range.endContainer)
      ) {
        const wrapper = document.createElement(semantic.tagName.toLowerCase());
        wrapper.append(fragment);
        container.append(wrapper);
      } else container.append(fragment);
    }
    return { text, html: container.innerHTML, baseUrl: location.href };
  }
  function toast(message: string, error = false): void {
    if (!settings.showToast && !error) return;
    toastHost?.remove();
    const element = document.createElement('div');
    const shadow = element.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent =
      ':host{all:initial;position:fixed;bottom:24px;right:24px;z-index:2147483647;pointer-events:none}div{font:14px/1.5 system-ui,sans-serif;color:#fff;background:#183d33;padding:13px 18px;border-radius:10px;max-width:320px;box-shadow:0 6px 24px #0003}';
    const body = document.createElement('div');
    body.setAttribute('role', error ? 'alert' : 'status');
    body.textContent = message;
    shadow.append(style, body);
    document.documentElement.append(element);
    toastHost = element;
    setTimeout(() => {
      element.remove();
      if (toastHost === element) toastHost = null;
    }, 2500);
  }
  document.addEventListener(
    'copy',
    (event) => {
      if ((!settings.enabled && !force) || !event.isTrusted || !event.clipboardData) return;
      try {
        const input = selection();
        if (!input.text.trim()) return;
        const result = transform(input, settings.options);
        if (!result.text) return;
        event.clipboardData.clearData();
        event.clipboardData.setData('text/plain', result.text);
        if (result.html !== null) event.clipboardData.setData('text/html', result.html);
        event.preventDefault();
        event.stopImmediatePropagation();
        copied = true;
        toast(
          result.warnings.length
            ? `CleanClip copied ${settings.options.format} text. ${result.warnings[0]}`
            : `CleanClip · ${settings.options.format} copied`,
        );
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Unable to clean this selection.', true);
      }
    },
    true,
  );
  extensionApi()?.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (
      sender.id !== extensionApi()?.runtime.id ||
      typeof message !== 'object' ||
      message === null ||
      !('type' in message)
    )
      return;
    if (message.type === 'selection') {
      try {
        respond(selection());
      } catch {
        respond({ text: '' });
      }
    }
    if (message.type === 'clean-selection') {
      void readSettings()
        .then((value) => {
          settings = value;
          force = true;
          copied = false;
          try {
            if (!selection().text.trim()) {
              toast('Select some text first.', true);
              respond({ ok: false });
              return;
            }
            // Chromium grants execCommand('copy') to extension content scripts with
            // clipboardWrite. It synchronously fires our copy handler on HTTP as well.
            const succeeded = document.execCommand('copy');
            if (!succeeded || !copied)
              toast('Copy was blocked. Use the toolbar preview instead.', true);
            respond({ ok: succeeded && copied });
          } finally {
            force = false;
          }
        })
        .catch(() => {
          toast('Settings could not be loaded.', true);
          respond({ ok: false });
        });
      return true;
    }
    return false;
  });
}
