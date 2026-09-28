import type { ProjectStatus, ProjectStatusId } from '../types/ui';

export const PROJECT_STATUSES: Record<ProjectStatusId, ProjectStatus> = {
  draft: { id: 'draft', label: 'Borrador', tone: 'info', progress: 15 },
  development: { id: 'development', label: 'En desarrollo', tone: 'warn', progress: 45 },
  review: { id: 'review', label: 'En revisión', tone: 'info', progress: 75 },
  approved: { id: 'approved', label: 'Aprobado', tone: 'ok', progress: 100 },
};

export const DEFAULT_STATUS: ProjectStatusId = 'development';
