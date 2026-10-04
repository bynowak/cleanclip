import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_INPUT_LENGTH,
  OPTION_LABELS,
  PRESETS,
  transform,
  type CleanOptions,
  type ClipInput,
  type PresetName,
} from '../core';
import {
  extensionApi,
  getPageSelection,
  openSettings,
  readSettings,
  revokeWebsiteAccess,
  saveSettings,
  setAutomatic,
  watchSettings,
  writeClipboard,
} from '../platform/browser';
import { DEFAULT_SETTINGS, type Settings } from '../platform/settings';

const SAMPLE: ClipInput = {
  text: 'A cleaner copy\n\nKeep the structure, leave the clutter.\n\nFirst point\nA useful link\n\n“Ready to paste.”',
  html: '<h2 style="color:purple">A cleaner copy</h2><p>Keep the <strong>structure</strong>, leave the clutter.</p><ul><li>First point</li><li><a href="https://example.com/guide?utm_source=chat&amp;page=2">A useful link</a></li></ul><p>“Ready to paste.” citeturn0search1</p>',
};
const DESCRIPTIONS: Record<PresetName, string> = {
  Plain: 'Readable text with paragraphs and list markers.',
  Markdown: 'Headings, lists, links, tables and code for your editor.',
  Writing: 'Straight quotes and link labels, ready for a draft.',
  Developer: 'Markdown with code whitespace and Unicode preserved.',
};
export function App() {
  const isOptions = location.pathname.endsWith('options.html');
  const installed = Boolean(extensionApi());
  const [settings, setSettings] = useState<Settings>(structuredClone(DEFAULT_SETTINGS));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState<ClipInput>({ text: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [shortcut, setShortcut] = useState('Alt+Shift+C');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let mounted = true;
    const api = extensionApi();
    void Promise.all([
      readSettings(),
      api
        ? api.permissions.contains({ origins: ['https://*/*', 'http://*/*'] })
        : Promise.resolve(false),
    ])
      .then(([value, allowed]) => {
        if (mounted) {
          setSettings({ ...value, enabled: value.enabled && allowed });
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) setError('Settings could not be loaded. Reopen CleanClip to try again.');
      });
    const unsubscribe = watchSettings((value) => {
      if (mounted) setSettings(value);
    });
    if (api) {
      void api.commands.getAll().then((commands) => {
        if (mounted)
          setShortcut(
            commands.find((command) => command.name === 'clean-selection')?.shortcut ||
              'Unassigned',
          );
      });
    }
    return () => {
      mounted = false;
      unsubscribe();
      clearTimeout(noticeTimer.current);
    };
  }, []);
  const preview = useMemo(() => {
    try {
      return { result: transform(input, settings.options), error: '' };
    } catch (issue) {
      return {
        result: null,
        error: issue instanceof Error ? issue.message : 'Unable to clean this input.',
      };
    }
  }, [input, settings.options]);
  function announce(message: string): void {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3500);
  }
  async function run(operation: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }
  function persist(updated: Settings): void {
    void run(async () => {
      await saveSettings(updated);
      setSettings(updated);
    });
  }
  function updateOption<Key extends keyof CleanOptions>(key: Key, value: CleanOptions[Key]): void {
    persist({ ...settings, preset: 'Custom', options: { ...settings.options, [key]: value } });
  }
  const disabled = busy || !ready;
  return (
    <main className={isOptions ? 'app settings-app' : 'app popup-app'}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            ↳
          </span>
          <div>
            <h1>
              cleanclip<span className="brand-dot">.</span>
            </h1>
            <p>Copy the content. Keep the structure.</p>
          </div>
        </div>
        {!isOptions && (
          <button
            className="icon-button"
            onClick={() => void run(openSettings)}
            aria-label="Open settings"
            title="Settings"
          >
            ⚙
          </button>
        )}
      </header>
      {!installed && (
        <p className="preview-banner">
          Browser preview · automatic cleaning requires the installed extension.
        </p>
      )}
      {isOptions && (
        <div className="settings-intro">
          <span className="eyebrow">Your copy, your rules</span>
          <h2>
            Less cleanup.
            <br />
            More useful text.
          </h2>
          <p>
            All changes are saved on this device. Clipboard content is never stored, synced or sent
            anywhere.
          </p>
        </div>
      )}
      <section className="automatic-panel" aria-label="Automatic cleaning">
        <div>
          <strong>Automatic cleaning</strong>
          <p>
            {settings.enabled
              ? 'On · ordinary website copies use your settings.'
              : 'Off · use the preview or shortcut for one-off copies.'}
          </p>
        </div>
        <button
          className={`switch ${settings.enabled ? 'on' : ''}`}
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Automatic cleaning"
          disabled={disabled}
          onClick={() =>
            void run(async () => {
              const updated = await setAutomatic(!settings.enabled, settings);
              setSettings(updated);
              announce(
                updated.enabled
                  ? 'Automatic cleaning enabled. Reload existing pages to activate it.'
                  : 'Automatic cleaning disabled.',
              );
            })
          }
        >
          <span />
        </button>
      </section>
      <div className={isOptions ? 'settings-grid' : ''}>
        <div className="controls-column">
          <section className="control-section">
            <div className="section-label">
              <h2>Preset</h2>
              <span>{settings.preset === 'Custom' ? 'Customized' : 'Start here'}</span>
            </div>
            <div className="preset-group" role="group" aria-label="Cleaning presets">
              {(Object.keys(PRESETS) as PresetName[]).map((name) => (
                <button
                  type="button"
                  key={name}
                  className={settings.preset === name ? 'selected' : ''}
                  aria-pressed={settings.preset === name}
                  disabled={disabled}
                  onClick={() =>
                    persist({ ...settings, preset: name, options: { ...PRESETS[name] } })
                  }
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="helper">
              {settings.preset === 'Custom'
                ? 'Your toggles take priority. Choose a preset to reset them.'
                : DESCRIPTIONS[settings.preset]}
            </p>
          </section>
          <section className="control-section">
            <div className="section-label">
              <h2>Output</h2>
              <span>Fonts &amp; colors always removed</span>
            </div>
            <label className="select-label">
              <span className="sr-only">Output format</span>
              <select
                aria-label="Output format"
                value={settings.options.format}
                disabled={disabled}
                onChange={(event) =>
                  updateOption('format', event.target.value as CleanOptions['format'])
                }
              >
                <option value="plain">Plain text</option>
                <option value="markdown">Clean Markdown</option>
                <option value="rich">Clean rich text</option>
              </select>
            </label>
            <label className="toggle-line">
              <span>Keep link destinations</span>
              <input
                type="checkbox"
                checked={settings.options.links === 'keep'}
                disabled={disabled}
                onChange={(event) =>
                  updateOption('links', event.target.checked ? 'keep' : 'remove')
                }
              />
            </label>
            <p className="helper">
              Turning this off keeps link labels. Bare URLs typed in prose stay as text.
            </p>
          </section>
          <details className="cleaning-details" open={isOptions}>
            <summary>
              Cleaning options{' '}
              <span>{settings.preset === 'Custom' ? 'Custom' : settings.preset}</span>
            </summary>
            <div className="toggle-list">
              {(Object.keys(OPTION_LABELS) as (keyof typeof OPTION_LABELS)[]).map((key) => (
                <label className="toggle-line" key={key}>
                  <span>{OPTION_LABELS[key]}</span>
                  <input
                    type="checkbox"
                    checked={settings.options[key]}
                    disabled={disabled}
                    onChange={(event) => updateOption(key, event.target.checked)}
                  />
                </label>
              ))}
            </div>
            <p className="helper">
              Code blocks keep indentation and quotes. Language joiners and emoji sequences remain
              intact.
            </p>
          </details>
          {isOptions && (
            <section className="control-section settings-privacy">
              <h2>Behavior &amp; privacy</h2>
              <label className="toggle-line">
                <span>Show page copy confirmation</span>
                <input
                  type="checkbox"
                  checked={settings.showToast}
                  disabled={disabled}
                  onChange={(event) => persist({ ...settings, showToast: event.target.checked })}
                />
              </label>
              <p>
                Automatic cleaning asks for access to HTTP and HTTPS websites. Page selection is
                handled locally, only when copied. Disabling stops cleaning; revoke access to remove
                the permission too.
              </p>
              <button
                className="text-button"
                disabled={disabled || !installed}
                onClick={() =>
                  void run(async () => {
                    setSettings(await revokeWebsiteAccess(settings));
                    announce('Website access removed.');
                  })
                }
              >
                Revoke website access
              </button>
              <button
                className="text-button"
                disabled={disabled}
                onClick={() => persist(structuredClone(DEFAULT_SETTINGS))}
              >
                Reset settings
              </button>
              <div className="shortcut-note">
                <strong>Clean selection: {shortcut}</strong>
                <p>
                  Change shortcuts at chrome://extensions/shortcuts (edge://extensions/shortcuts in
                  Edge). Browser-reserved pages cannot be accessed.
                </p>
              </div>
            </section>
          )}
        </div>
        <section className="preview-section" aria-labelledby="preview-title">
          <div className="section-label">
            <h2 id="preview-title">Preview</h2>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setInput(SAMPLE);
                setError('');
                sourceRef.current?.focus();
              }}
            >
              Try sample
            </button>
          </div>
          <div className="preview-tools">
            <button
              className="secondary-button"
              disabled={disabled || !installed}
              onClick={() =>
                void run(async () => {
                  setInput(await getPageSelection());
                  announce('Page selection loaded.');
                })
              }
            >
              Use page selection
            </button>
            <button
              className="text-button"
              disabled={!input.text && !input.html}
              onClick={() => {
                setInput({ text: '' });
                setError('');
              }}
            >
              Clear
            </button>
          </div>
          <div className="preview-panes">
            <label className="preview-pane">
              <span className="pane-label">
                Input{' '}
                <small>{input.html ? 'HTML structure captured' : 'Paste text to begin'}</small>
              </span>
              <textarea
                ref={sourceRef}
                aria-label="Input text"
                placeholder="Paste text here. Formatting is captured when available."
                value={input.text}
                maxLength={MAX_INPUT_LENGTH}
                onChange={(event) => setInput({ text: event.target.value })}
                onPaste={(event) => {
                  const text = event.clipboardData.getData('text/plain');
                  const html = event.clipboardData.getData('text/html');
                  if (html && text) {
                    event.preventDefault();
                    setInput({ text, html });
                  }
                }}
                spellCheck={false}
              />
            </label>
            <div className="preview-pane">
              <span className="pane-label">
                Cleaned{' '}
                <small>
                  {settings.options.format === 'rich'
                    ? 'Plain-text fallback shown'
                    : settings.options.format}
                </small>
              </span>
              <textarea
                aria-label="Cleaned output"
                value={preview.result?.text ?? ''}
                readOnly
                placeholder="Your cleaned text appears here."
                spellCheck={false}
              />
            </div>
          </div>
          {preview.result?.html && (
            <details className="rich-details">
              <summary>View cleaned rich text</summary>
              <div
                className="rich-output"
                onClick={(event) => event.preventDefault()}
                dangerouslySetInnerHTML={{ __html: preview.result.html }}
              />
            </details>
          )}
          {preview.result?.warnings.map((warning) => (
            <p className="warning" key={warning}>
              {warning}
            </p>
          ))}
          <div className="copy-row">
            <span>{preview.result?.text.length ?? 0} characters</span>
            <button
              className="primary-button"
              disabled={disabled || !preview.result?.text || Boolean(preview.error)}
              onClick={() =>
                void run(async () => {
                  if (preview.result) {
                    await writeClipboard(preview.result);
                    announce(
                      `Copied as ${settings.options.format === 'rich' ? 'clean rich text' : settings.options.format}.`,
                    );
                  }
                })
              }
            >
              Copy cleaned text <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      </div>
      {(error || preview.error) && (
        <p className="error" role="alert">
          {error || preview.error}
        </p>
      )}
      <div className="notice" role="status" aria-live="polite">
        {notice}
      </div>
      <footer className="app-footer">
        <span className="privacy-dot" />
        Local only · no analytics · no clipboard history
        {!isOptions && <span className="shortcut">{shortcut}</span>}
      </footer>
    </main>
  );
}
