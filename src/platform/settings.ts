import { PRESETS, type CleanOptions, type PresetName } from '../core';
export interface Settings {
  version: 1;
  enabled: boolean;
  preset: PresetName | 'Custom';
  options: CleanOptions;
  showToast: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  enabled: false,
  preset: 'Plain',
  options: { ...PRESETS.Plain },
  showToast: true,
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export function parseSettings(value: unknown): Settings {
  if (!isRecord(value) || value.version !== 1) return structuredClone(DEFAULT_SETTINGS);
  const options: CleanOptions = { ...PRESETS.Plain };
  if (isRecord(value.options)) {
    for (const key of Object.keys(options) as (keyof CleanOptions)[]) {
      const item = value.options[key];
      if (key === 'format') {
        if (item === 'plain' || item === 'markdown' || item === 'rich') options.format = item;
      } else if (key === 'links') {
        if (item === 'keep' || item === 'remove') options.links = item;
      } else if (typeof item === 'boolean') options[key] = item;
    }
  }
  const preset =
    typeof value.preset === 'string' &&
    (value.preset === 'Custom' || Object.hasOwn(PRESETS, value.preset))
      ? (value.preset as Settings['preset'])
      : 'Custom';
  return {
    version: 1,
    enabled: value.enabled === true,
    preset,
    options,
    showToast: value.showToast !== false,
  };
}
