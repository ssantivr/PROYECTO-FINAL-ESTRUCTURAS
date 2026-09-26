import type { Project } from '../types/project';
import { api, ApiError } from './apiClient';
import { loadProject, saveProject } from './persistence';

export type SyncTarget = 'server' | 'local';

export interface SyncResult {
  project: Project;
  target: SyncTarget;
}

const LAST_ID_KEY = 'arquila.lastProjectId';

function rememberId(id: string): void {
  try {
    localStorage.setItem(LAST_ID_KEY, id);
  } catch {
    /* per-browser convenience only */
  }
}

function lastId(): string | null {
  try {
    return localStorage.getItem(LAST_ID_KEY);
  } catch {
    return null;
  }
}

/** Loads the last project from the API; falls back to the local copy when the server is unreachable. */
export async function loadInitialProject(fallback: Project): Promise<SyncResult> {
  try {
    const summaries = await api.listProjects();
    const id = summaries.find((s) => s.id === lastId())?.id ?? summaries[0]?.id;
    if (id) {
      const project = await api.getProject(id);
      rememberId(project.id);
      return { project, target: 'server' };
    }
    const created = await api.createProject(loadProject() ?? fallback);
    rememberId(created.id);
    return { project: created, target: 'server' };
  } catch {
    return { project: loadProject() ?? fallback, target: 'local' };
  }
}

/** Saves to the API (creating the project if the server does not know it) and always keeps a local copy. */
export async function persistProject(project: Project): Promise<SyncResult> {
  try {
    const saved = await api.replaceProject(project).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return api.createProject(project);
      throw error;
    });
    rememberId(saved.id);
    saveProject(saved);
    return { project: saved, target: 'server' };
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0 && error.status < 500) throw error;
    return { project: saveProject(project), target: 'local' };
  }
}
