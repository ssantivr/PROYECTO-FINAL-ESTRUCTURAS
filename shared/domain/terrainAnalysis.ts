import type { Terrain } from '../types/project';

const DEG = Math.PI / 180;

export function elevationAt(terrain: Terrain, x: number, z: number): number {
  const base = (terrain.slopePercent / 100) * z;
  const undulation = 0.18 * Math.sin(x * 0.55 + 0.4) * Math.cos(z * 0.32) + 0.08 * Math.sin(z * 0.9);
  return base + undulation;
}

export interface ProfilePoint {
  distance: number;
  elevation: number;
}

export function longitudinalProfile(terrain: Terrain, samples = 25): ProfilePoint[] {
  const x = terrain.width / 2;
  return Array.from({ length: samples }, (_, i) => {
    const distance = (terrain.length * i) / (samples - 1);
    return { distance, elevation: terrain.elevation + elevationAt(terrain, x, distance) };
  });
}

export interface SlopeBucket {
  label: string;
  share: number;
}

export function slopeDistribution(terrain: Terrain): SlopeBucket[] {
  const classes = [
    { label: '0–3 %', max: 3 },
    { label: '3–6 %', max: 6 },
    { label: '6–9 %', max: 9 },
    { label: '9–12 %', max: 12 },
    { label: '> 12 %', max: Infinity },
  ];
  const counts = classes.map(() => 0);
  const step = 0.5;
  let total = 0;
  for (let x = step; x < terrain.width - step; x += step) {
    for (let z = step; z < terrain.length - step; z += step) {
      const dx = (elevationAt(terrain, x + step, z) - elevationAt(terrain, x - step, z)) / (2 * step);
      const dz = (elevationAt(terrain, x, z + step) - elevationAt(terrain, x, z - step)) / (2 * step);
      const slope = Math.hypot(dx, dz) * 100;
      const index = classes.findIndex((c) => slope < c.max);
      counts[index] = (counts[index] ?? 0) + 1;
      total++;
    }
  }
  return classes.map((c, i) => ({ label: c.label, share: (counts[i] ?? 0) / total }));
}

export interface SunPosition {
  altitude: number;
  azimuth: number;
}

function declination(dayOfYear: number): number {
  return 23.44 * Math.sin((360 / 365) * (dayOfYear - 81) * DEG);
}

export function sunPosition(latitude: number, dayOfYear: number, solarHour: number): SunPosition {
  const decl = declination(dayOfYear) * DEG;
  const lat = latitude * DEG;
  const hourAngle = (solarHour - 12) * 15 * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const altitude = Math.asin(sinAlt);
  const cosAz = (Math.sin(decl) - Math.sin(altitude) * Math.sin(lat)) / (Math.cos(altitude) * Math.cos(lat));
  let azimuth = Math.acos(Math.min(1, Math.max(-1, cosAz))) / DEG;
  if (hourAngle > 0) azimuth = 360 - azimuth;
  return { altitude: altitude / DEG, azimuth };
}

export function dayLength(latitude: number, dayOfYear: number): number {
  const decl = declination(dayOfYear) * DEG;
  const cosH = -Math.tan(latitude * DEG) * Math.tan(decl);
  return (2 * Math.acos(Math.min(1, Math.max(-1, cosH)))) / (15 * DEG);
}

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const;

const CLEAR_SKY_FRACTION = [0.34, 0.33, 0.3, 0.27, 0.3, 0.36, 0.42, 0.44, 0.38, 0.3, 0.27, 0.31] as const;

export interface MonthlySun {
  month: string;
  dayLength: number;
  sunHours: number;
  noonAltitude: number;
}

export function monthlyInsolation(latitude: number): MonthlySun[] {
  return MONTHS.map((month, i) => {
    const day = Math.round(15 + i * 30.4);
    const length = dayLength(latitude, day);
    return {
      month,
      dayLength: length,
      sunHours: length * (CLEAR_SKY_FRACTION[i] ?? 0.3),
      noonAltitude: sunPosition(latitude, day, 12).altitude,
    };
  });
}

export function dayOfYearFromMonth(monthIndex: number): number {
  return Math.round(15 + monthIndex * 30.4);
}
