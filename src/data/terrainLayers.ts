import type { TerrainLayerDef } from '../types/ui';

export const TERRAIN_LAYERS: readonly TerrainLayerDef[] = [
  { id: 'elevation', label: 'Elevación', swatch: '#1c5cab', defaultOn: true },
  { id: 'slope', label: 'Pendientes', swatch: '#F2C94C', defaultOn: false },
  { id: 'contours', label: 'Curvas de nivel', swatch: '#8FA3B5', defaultOn: true },
  { id: 'grid', label: 'Retícula 2 m', swatch: '#27445e', defaultOn: false },
  { id: 'setbacks', label: 'Retiros', swatch: '#FF647C', defaultOn: true },
  { id: 'zones', label: 'Zonas exteriores', swatch: '#39D98A', defaultOn: true },
  { id: 'footprint', label: 'Huella construida', swatch: '#1597E5', defaultOn: true },
  { id: 'sun', label: 'Trayectoria solar', swatch: '#20C7F5', defaultOn: false },
];

export const SLOPE_CLASSES = [
  { max: 3, label: '0–3 %', color: '#39D98A' },
  { max: 6, label: '3–6 %', color: '#8fd9a8' },
  { max: 9, label: '6–9 %', color: '#F2C94C' },
  { max: 12, label: '9–12 %', color: '#f29a5c' },
  { max: Infinity, label: '> 12 %', color: '#FF647C' },
] as const;
