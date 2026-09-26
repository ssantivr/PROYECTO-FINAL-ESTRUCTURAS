import type { Project, ViewId } from '../types/project';
import { Store } from './store';

export interface AppState {
  project: Project;
  view: ViewId;
  dirty: boolean;
  /** Month index used by the solar analysis and the 3D sun. */
  sunMonth: number;
  sunHour: number;
}

export type AppStore = Store<AppState>;

export function createAppStore(project: Project): AppStore {
  return new Store<AppState>({ project, view: 'overview', dirty: false, sunMonth: 5, sunHour: 10 });
}

export function updateProject(store: AppStore, recipe: (project: Project) => Project): void {
  store.set((state) => ({ project: recipe(state.project), dirty: true }));
}
