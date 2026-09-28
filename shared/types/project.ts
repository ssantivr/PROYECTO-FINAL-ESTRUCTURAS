export type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type BuildingType = 'house' | 'residential' | 'office' | 'retail' | 'warehouse' | 'hotel' | 'other';

export type LotShape = 'rectangular' | 'corner' | 'trapezoidal' | 'irregular';

export interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface Room extends Rect {
  id: string;
  name: string;
}

export interface Opening {
  offset: number;
  width: number;
  height: number;
  sill: number;
  kind: 'window' | 'door';
}

export type FacadeSide = 'front' | 'back' | 'left' | 'right';

export interface Floor {
  id: string;
  name: string;
  level: number;
  height: number;
  footprint: Rect;
  rooms: Room[];
  openings: Record<FacadeSide, Opening[]>;
}

export interface Roof {
  kind: 'gable';
  pitchDeg: number;
  overhang: number;
}

export interface Terrain {
  width: number;
  length: number;
  shape: LotShape;
  slopePercent: number;
  elevation: number;
  orientation: Orientation;
  accessSide: FacadeSide;
  latitude: number;
  longitude: number;
  soilType: string;
  gardenArea: number;
  parkingArea: number;
  poolArea: number;
  maxCos: number;
  maxCus: number;
  maxFloors: number;
}

export interface BuildingProgram {
  floors: number;
  bedrooms: number;
  bathrooms: number;
  kitchen: boolean;
  livingRoom: boolean;
  diningRoom: boolean;
  garage: boolean;
  terrace: boolean;
  balcony: boolean;
  garden: boolean;
  pool: boolean;
  laundry: boolean;
  office: boolean;
}

export interface Building {
  setbackX: number;
  setbackY: number;
  program: BuildingProgram;
  floors: Floor[];
  roof: Roof;
}

export type MaterialCategory = 'Estructura' | 'Mampostería' | 'Acabados' | 'Fachada' | 'Cubierta' | 'Pisos' | 'Carpintería' | 'Aislamiento';

export type FinishSlot = 'walls' | 'roof' | 'floor' | 'frames';

export type Finishes = Record<FinishSlot, string>;

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  description: string;
  unit: string;
  ratePerM2: number;
  unitPrice: number;
  slot: FinishSlot | null;
  color: string;
  roughness: number;
  metalness: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  buildingType: BuildingType;
  city: string;
  region: string;
  style: string;
  budget: number;
  terrain: Terrain;
  building: Building;
  finishes: Finishes;
  materials: Material[];
  updatedAt: string;
}

export type ViewId = 'overview' | 'project' | 'newProject' | 'viewer' | 'plans' | 'terrain' | 'construction' | 'materials' | 'ai' | 'settings';

export const FINISH_SLOTS: readonly FinishSlot[] = ['walls', 'roof', 'floor', 'frames'];

export const BUILDING_TYPES: readonly BuildingType[] = ['house', 'residential', 'office', 'retail', 'warehouse', 'hotel', 'other'];
