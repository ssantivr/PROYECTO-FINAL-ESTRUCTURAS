import type { IconName } from '../core/dom';
import type { BuildingType, ViewId } from './project';

export interface NavItem {
  label: string;
  icon: IconName;
  view: ViewId;
}

export interface TabItem {
  label: string;
  view: ViewId;
}

export type ProjectStatusId = 'draft' | 'development' | 'review' | 'approved';

export type StatusTone = 'info' | 'ok' | 'warn' | 'bad';

export interface ProjectStatus {
  id: ProjectStatusId;
  label: string;
  tone: StatusTone;
  progress: number;
}

export type TerrainLayerId = 'elevation' | 'contours' | 'slope' | 'setbacks' | 'footprint' | 'zones' | 'sun' | 'grid';

export interface TerrainLayerDef {
  id: TerrainLayerId;
  label: string;
  swatch: string;
  defaultOn: boolean;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  buildingType: BuildingType;
  style: string;
  budget: number;
  city: string;
  region: string;
  floors: number;
  area: number;
}

export type AIProviderId = 'auto' | 'server' | 'rules' | 'external';

export interface AIProviderDef {
  id: AIProviderId;
  label: string;
  description: string;
}

export interface AppSettings {
  showAxes: boolean;
  showDimensions: boolean;
  autosave: boolean;
  aiProvider: AIProviderId;
  aiEndpoint: string;
  aiModel: string;
  aiApiKey: string;
}
