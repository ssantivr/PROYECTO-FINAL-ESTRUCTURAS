import type { BuildingType, Project } from '../types/project';
import type { AppStore } from '../state/appState';
import { sampleProject } from '../data/sampleProject';
import { materialCatalog, defaultFinishes } from '../../shared/data/materialCatalog';
import { generateLayout } from '../../shared/domain/layoutGenerator';
import { computeMetrics } from './metrics';
import { api, ApiError, type ProjectSummary } from './apiClient';
import { loadProject, saveProject } from './persistence';

const LAST_ID_KEY = 'arquila.lastProjectId';

function rememberId(id: string): void {
  try {
    localStorage.setItem(LAST_ID_KEY, id);
  } catch {
  }
}

function lastId(): string | null {
  try {
    return localStorage.getItem(LAST_ID_KEY);
  } catch {
    return null;
  }
}

export function loadLocalProject(): Project {
  const stored = loadProject();
  return stored && stored.finishes && stored.building?.program ? stored : sampleProject;
}

function summarize(project: Project): ProjectSummary {
  const metrics = computeMetrics(project);
  return {
    id: project.id,
    name: project.name,
    buildingType: project.buildingType,
    city: project.city,
    region: project.region,
    style: project.style,
    floors: project.building.floors.length,
    rooms: project.building.floors.reduce((sum, f) => sum + f.rooms.length, 0),
    builtArea: metrics.builtArea,
    lotArea: metrics.lotArea,
    updatedAt: project.updatedAt,
  };
}

export async function loadServerProject(): Promise<{ project: Project; projects: ProjectSummary[] }> {
  let projects = await api.listProjects();
  const id = projects.find((s) => s.id === lastId())?.id ?? projects[0]?.id;
  if (id) {
    const project = await api.getProject(id);
    rememberId(project.id);
    return { project, projects };
  }
  const created = await api.createProject(sampleProject);
  rememberId(created.id);
  projects = await api.listProjects();
  return { project: created, projects };
}

export async function refreshProjects(store: AppStore): Promise<void> {
  if (store.get().mode === 'local') {
    store.set({ projects: [summarize(store.get().project)] });
    return;
  }
  store.set({ projects: await api.listProjects() });
}

export async function openProject(store: AppStore, id: string): Promise<void> {
  const project = await api.getProject(id);
  rememberId(project.id);
  store.set({ project, dirty: false });
}

export interface NewProjectInput {
  name: string;
  description: string;
  buildingType: BuildingType;
  city: string;
  region: string;
  budget: number;
  style: string;
}

export function draftProject(input: NewProjectInput): Project {
  const terrain = { ...sampleProject.terrain, width: 12, length: 24, slopePercent: 3, gardenArea: 60, parkingArea: 0, poolArea: 0 };
  const program = { ...sampleProject.building.program, floors: 2, bedrooms: input.buildingType === 'house' || input.buildingType === 'residential' ? 3 : 2, bathrooms: 2, garage: false };
  const { building } = generateLayout(terrain, program, input.buildingType);
  return {
    ...input,
    id: `local-${Date.now()}`,
    terrain,
    building,
    finishes: { ...defaultFinishes },
    materials: materialCatalog,
    updatedAt: new Date().toISOString(),
  };
}

export async function createProject(store: AppStore, input: NewProjectInput): Promise<Project> {
  const draft = draftProject(input);
  const project = store.get().mode === 'server' ? await api.createProject(draft) : saveProject(draft);
  rememberId(project.id);
  store.set({ project, dirty: false, view: 'terrain' });
  await refreshProjects(store);
  return project;
}

export async function deleteProject(store: AppStore, id: string): Promise<void> {
  await api.deleteProject(id);
  await refreshProjects(store);
  if (store.get().project.id === id) {
    const next = store.get().projects[0];
    if (next) await openProject(store, next.id);
    else {
      const { project, projects } = await loadServerProject();
      store.set({ project, projects, dirty: false });
    }
  }
}

export async function persistProject(store: AppStore, project: Project): Promise<Project> {
  if (store.get().mode === 'local') return saveProject(project);
  const saved = await api.replaceProject(project).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return api.createProject(project);
    throw error;
  });
  rememberId(saved.id);
  saveProject(saved);
  return saved;
}
