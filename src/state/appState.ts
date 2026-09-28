import type { Project, ViewId } from '../types/project';
import type { AppSettings, ProjectStatusId } from '../types/ui';
import type { AIStatus, AuthUser, ProjectSummary } from '../services/apiClient';
import { loadSettings, loadStatuses, saveSettings, saveStatuses } from '../services/settingsStorage';
import { Store } from '../core/store';

export type SyncMode = 'server' | 'local';

export interface AppState {
  project: Project;
  view: ViewId;
  dirty: boolean;
  mode: SyncMode;
  user: AuthUser | null;
  projects: ProjectSummary[];
  aiStatus: AIStatus | null;
  sunMonth: number;
  sunHour: number;
  settings: AppSettings;
  statuses: Record<string, ProjectStatusId>;
}

export type AppStore = Store<AppState>;

export function createAppStore(project: Project, mode: SyncMode, user: AuthUser | null): AppStore {
  return new Store<AppState>({
    project, view: 'overview', dirty: false, mode, user, projects: [], aiStatus: null, sunMonth: 5, sunHour: 10,
    settings: loadSettings(), statuses: loadStatuses(),
  });
}

export function updateProject(store: AppStore, recipe: (project: Project) => Project): void {
  store.set((state) => ({ project: recipe(state.project), dirty: true }));
}

export function updateSettings(store: AppStore, patch: Partial<AppSettings>): void {
  const settings = { ...store.get().settings, ...patch };
  saveSettings(settings);
  store.set({ settings });
}

export function setProjectStatus(store: AppStore, id: string, status: ProjectStatusId): void {
  const statuses = { ...store.get().statuses, [id]: status };
  saveStatuses(statuses);
  store.set({ statuses });
}
