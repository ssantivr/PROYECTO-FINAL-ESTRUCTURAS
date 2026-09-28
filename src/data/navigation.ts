import type { NavItem, TabItem } from '../types/ui';

export const SIDEBAR_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', icon: 'home', view: 'overview' },
  { label: 'Proyectos', icon: 'folder', view: 'project' },
  { label: 'Nuevo Proyecto', icon: 'plus', view: 'newProject' },
  { label: 'Terrenos', icon: 'terrain', view: 'terrain' },
  { label: 'Materiales', icon: 'layers', view: 'materials' },
  { label: 'Visualización 3D', icon: 'cube', view: 'viewer' },
  { label: 'IA Asistente', icon: 'spark', view: 'ai' },
  { label: 'Configuración', icon: 'settings', view: 'settings' },
];

export const PROJECT_TABS: readonly TabItem[] = [
  { label: 'Vista 3D', view: 'viewer' },
  { label: 'Planos', view: 'plans' },
  { label: 'Terreno', view: 'terrain' },
  { label: 'Construcción', view: 'construction' },
  { label: 'Materiales', view: 'materials' },
  { label: 'IA', view: 'ai' },
];
