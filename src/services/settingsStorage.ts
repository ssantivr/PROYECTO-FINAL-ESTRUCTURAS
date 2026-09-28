import type { AppSettings, ProjectStatusId } from '../types/ui';
import { DEFAULT_SETTINGS } from '../data/aiProviders';

const SETTINGS_KEY = 'arquila.settings.v1';
const STATUS_KEY = 'arquila.projectStatus.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(read<Partial<AppSettings>>(SETTINGS_KEY) ?? {}) };
}

export function saveSettings(settings: AppSettings): void {
  write(SETTINGS_KEY, settings);
}

export function loadStatuses(): Record<string, ProjectStatusId> {
  return read<Record<string, ProjectStatusId>>(STATUS_KEY) ?? {};
}

export function saveStatuses(statuses: Record<string, ProjectStatusId>): void {
  write(STATUS_KEY, statuses);
}
