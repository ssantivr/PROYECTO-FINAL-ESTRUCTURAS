import type { AppState } from './appState';
import type { ProjectStatus } from '../types/ui';
import { DEFAULT_STATUS, PROJECT_STATUSES } from '../data/projectStatus';
import { computeMetrics, type ProjectMetrics } from '../services/metrics';

export function selectProjectStatus(state: AppState, id = state.project.id): ProjectStatus {
  return PROJECT_STATUSES[state.statuses[id] ?? DEFAULT_STATUS];
}

export function selectMetrics(state: AppState): ProjectMetrics {
  return computeMetrics(state.project);
}

export function selectRoomCount(state: AppState): number {
  return state.project.building.floors.reduce((sum, floor) => sum + floor.rooms.length, 0);
}
