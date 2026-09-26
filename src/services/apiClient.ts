import type { Project } from '../types/project';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const BASE_URL = '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor.');
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = (data ?? {}) as { error?: string; details?: unknown };
    throw new ApiError(response.status, payload.error ?? `Error ${response.status}`, payload.details);
  }
  return data as T;
}

export interface ProjectSummary {
  id: string;
  name: string;
  city: string;
  region: string;
  floors: number;
  builtArea: number;
  updatedAt: string;
}

type ProjectInput = Omit<Project, 'id' | 'updatedAt' | 'materials'>;

const toInput = ({ id: _id, updatedAt: _updatedAt, materials: _materials, ...input }: Project): ProjectInput => input;

export const api = {
  health: () => request<{ status: string; database: string }>('GET', '/health'),
  listProjects: () => request<ProjectSummary[]>('GET', '/projects'),
  getProject: (id: string) => request<Project>('GET', `/projects/${encodeURIComponent(id)}`),
  createProject: (project: Project) => request<Project>('POST', '/projects', toInput(project)),
  replaceProject: (project: Project) => request<Project>('PUT', `/projects/${encodeURIComponent(project.id)}`, toInput(project)),
};
