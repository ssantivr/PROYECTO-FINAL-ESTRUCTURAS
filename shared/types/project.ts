export type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

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
  /** Distance along the wall from its left end, in meters. */
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
  /** Footprint relative to the ground floor origin. */
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
  /** Average slope along the lot length, in percent. */
  slopePercent: number;
  elevation: number;
  orientation: Orientation;
  latitude: number;
  longitude: number;
  soilType: string;
  maxCos: number;
  maxCus: number;
  maxFloors: number;
}

export interface Building {
  /** Placement of the ground floor origin inside the lot. */
  setbackX: number;
  setbackY: number;
  floors: Floor[];
  roof: Roof;
}

export interface Material {
  id: string;
  name: string;
  category: 'Estructura' | 'Mampostería' | 'Acabados' | 'Cubierta' | 'Carpintería';
  unit: string;
  /** Quantity per m² of built area. */
  ratePerM2: number;
  unitPrice: number;
}

export interface Project {
  id: string;
  name: string;
  city: string;
  region: string;
  style: string;
  terrain: Terrain;
  building: Building;
  materials: Material[];
  updatedAt: string;
}

export type ViewId = 'overview' | 'project' | 'viewer' | 'plans' | 'terrain' | 'construction' | 'materials' | 'ai';
