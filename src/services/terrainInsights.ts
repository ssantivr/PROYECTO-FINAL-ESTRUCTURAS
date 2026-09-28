import type { Terrain } from '../types/project';
import { dayOfYearFromMonth, elevationAt, monthlyInsolation, sunPosition } from './terrainAnalysis';

export interface ReliefClass {
  label: string;
  tone: 'ok' | 'warn' | 'bad';
  note: string;
}

export function reliefClass(slopePercent: number): ReliefClass {
  if (slopePercent < 3) return { label: 'Plano', tone: 'ok', note: 'Cimentación convencional, drenaje superficial controlado.' };
  if (slopePercent < 8) return { label: 'Ondulado suave', tone: 'ok', note: 'Nivelaciones menores y drenaje perimetral.' };
  if (slopePercent < 15) return { label: 'Ondulado', tone: 'warn', note: 'Considerar plataformas escalonadas y muros de contención bajos.' };
  return { label: 'Escarpado', tone: 'bad', note: 'Requiere estudio geotécnico y contención estructural.' };
}

export function slopeAt(terrain: Terrain, x: number, z: number, step = 0.5): number {
  const dx = (elevationAt(terrain, x + step, z) - elevationAt(terrain, x - step, z)) / (2 * step);
  const dz = (elevationAt(terrain, x, z + step) - elevationAt(terrain, x, z - step)) / (2 * step);
  return Math.hypot(dx, dz) * 100;
}

export interface ElevationRange {
  min: number;
  max: number;
  drop: number;
}

export function elevationRange(terrain: Terrain, samples = 24): ElevationRange {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i <= samples; i++) {
    for (let j = 0; j <= samples; j++) {
      const e = elevationAt(terrain, (terrain.width * i) / samples, (terrain.length * j) / samples);
      min = Math.min(min, e);
      max = Math.max(max, e);
    }
  }
  return { min: terrain.elevation + min, max: terrain.elevation + max, drop: max - min };
}

export interface SunSummary {
  annualHours: number;
  bestMonth: string;
  worstMonth: string;
  noonAltitude: number;
  sunriseAzimuth: number;
  sunsetAzimuth: number;
}

export function sunSummary(latitude: number, monthIndex: number): SunSummary {
  const months = monthlyInsolation(latitude);
  const sorted = [...months].sort((a, b) => b.sunHours - a.sunHours);
  const day = dayOfYearFromMonth(monthIndex);
  return {
    annualHours: months.reduce((sum, m) => sum + m.sunHours * 30.4, 0),
    bestMonth: sorted[0]?.month ?? '',
    worstMonth: sorted.at(-1)?.month ?? '',
    noonAltitude: months[monthIndex]?.noonAltitude ?? 0,
    sunriseAzimuth: sunPosition(latitude, day, 6.5).azimuth,
    sunsetAzimuth: sunPosition(latitude, day, 17.5).azimuth,
  };
}

export function sunPath(latitude: number, monthIndex: number): Array<{ hour: number; altitude: number; azimuth: number }> {
  const day = dayOfYearFromMonth(monthIndex);
  const points: Array<{ hour: number; altitude: number; azimuth: number }> = [];
  for (let hour = 6; hour <= 18; hour += 1) {
    const p = sunPosition(latitude, day, hour);
    if (p.altitude > 0) points.push({ hour, ...p });
  }
  return points;
}
