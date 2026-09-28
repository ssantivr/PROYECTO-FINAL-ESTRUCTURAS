import type { BuildingProgram, BuildingType, Finishes, Material, Project, Terrain } from '../types/project';
import type {
  AIEnvelope, ChatMessage, ChatResult, LayoutSuggestionResult, MaterialRecommendationResult, TerrainAnalysisInput, TerrainAnalysisResult,
} from '../types/ai';

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
const TOKEN_KEY = 'arquila.token';

let token: string | null = readToken();

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
  }
}

export const hasAuthToken = (): boolean => token !== null;

export const UNAUTHORIZED_EVENT = 'arquila:unauthorized';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? null : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor.');
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = (data ?? {}) as { error?: string; details?: unknown };
    if (response.status === 401 && token) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new ApiError(response.status, payload.error ?? `Error ${response.status}`, payload.details);
  }
  return data as T;
}

export function describeApiError(error: unknown, fallback = 'Error inesperado.'): string {
  if (!(error instanceof Error)) return fallback;
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return error.message;
  const details = error.details.map((d: unknown) =>
    typeof d === 'string' ? d : `${(d as { path?: string }).path ?? ''}: ${(d as { message?: string }).message ?? ''}`);
  return `${error.message} ${details.join(' ')}`;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface ProjectSummary {
  id: string;
  name: string;
  buildingType: BuildingType;
  city: string;
  region: string;
  style: string;
  floors: number;
  rooms: number;
  builtArea: number;
  lotArea: number;
  updatedAt: string;
}

export interface FloorPlanRecord {
  id: string;
  kind: 'floor' | 'site' | 'elevation' | 'section';
  floorKey: string | null;
  name: string;
  createdAt: string;
}

export interface AIStatus {
  provider: 'lmstudio' | 'none';
  baseUrl: string;
  available: boolean;
  model: string | null;
  message: string;
}

export type ProjectInput = Omit<Project, 'id' | 'updatedAt' | 'materials'>;

export const toInput = ({ id: _id, updatedAt: _updatedAt, materials: _materials, ...input }: Project): ProjectInput => input;

const projectPath = (id: string) => `/projects/${encodeURIComponent(id)}`;

export const api = {
  health: () => request<{ status: string; database: string }>('GET', '/health'),

  register: (name: string, email: string, password: string) => request<AuthSession>('POST', '/auth/register', { name, email, password }),
  login: (email: string, password: string) => request<AuthSession>('POST', '/auth/login', { email, password }),
  me: () => request<AuthUser>('GET', '/auth/me'),

  listProjects: () => request<ProjectSummary[]>('GET', '/projects'),
  getProject: (id: string) => request<Project>('GET', projectPath(id)),
  createProject: (project: Project) => request<Project>('POST', '/projects', toInput(project)),
  replaceProject: (project: Project) => request<Project>('PUT', projectPath(project.id), toInput(project)),
  deleteProject: (id: string) => request<void>('DELETE', projectPath(id)),
  setFinishes: (id: string, finishes: Finishes) => request<Project>('POST', `${projectPath(id)}/materials`, finishes),

  listMaterials: () => request<Material[]>('GET', '/materials'),

  listFloorPlans: (id: string) => request<FloorPlanRecord[]>('GET', `${projectPath(id)}/floor-plans`),
  generateFloorPlans: (id: string) => request<FloorPlanRecord[]>('POST', `${projectPath(id)}/floor-plans`),

  aiStatus: () => request<AIStatus>('GET', '/ai/status'),
  chat: (body: { projectId?: string | undefined; project: ProjectInput; message: string; history: ChatMessage[] }) =>
    request<AIEnvelope<ChatResult>>('POST', '/ai/chat', body),
  analyzeTerrain: (body: { projectId?: string | undefined; terrain: TerrainAnalysisInput }) =>
    request<AIEnvelope<TerrainAnalysisResult>>('POST', '/ai/analyze-terrain', body),
  recommendMaterials: (body: { projectId?: string | undefined; project: ProjectInput }) =>
    request<AIEnvelope<MaterialRecommendationResult>>('POST', '/ai/recommend-materials', body),
  generateLayout: (body: { projectId?: string | undefined; terrain: Terrain; program: BuildingProgram; buildingType: BuildingType; budget: number; style: string }) =>
    request<AIEnvelope<LayoutSuggestionResult>>('POST', '/ai/generate-layout', body),
};
