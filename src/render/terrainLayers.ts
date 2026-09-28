import { formatNumber, s } from '../core/dom';
import type { Orientation, Project, Terrain } from '../types/project';
import type { TerrainLayerId } from '../types/ui';
import { SLOPE_CLASSES } from '../data/terrainLayers';
import { elevationAt } from '../services/terrainAnalysis';
import { slopeAt, sunPath } from '../services/terrainInsights';
import { siteZones } from './sitePlan';

const ELEVATION_BANDS = ['#0e2c4a', '#123a5e', '#164a74', '#1b5a8a', '#2369a0', '#2b79b3'] as const;
const ORIENTATION_DEG: Record<Orientation, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

interface Field {
  step: number;
  cols: number;
  rows: number;
  nodes: number[][];
  min: number;
  max: number;
}

function sampleField(terrain: Terrain): Field {
  const step = Math.max(0.4, Math.min(terrain.width, terrain.length) / 36);
  const cols = Math.ceil(terrain.width / step);
  const rows = Math.ceil(terrain.length / step);
  const nodes: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r <= rows; r++) {
    const row: number[] = [];
    for (let c = 0; c <= cols; c++) {
      const e = elevationAt(terrain, Math.min(c * step, terrain.width), Math.min(r * step, terrain.length));
      row.push(e);
      min = Math.min(min, e);
      max = Math.max(max, e);
    }
    nodes.push(row);
  }
  return { step, cols, rows, nodes, min, max };
}

function cellRect(terrain: Terrain, field: Field, r: number, c: number) {
  const x = c * field.step;
  const y = r * field.step;
  return { x, y, width: Math.min(field.step, terrain.width - x) + 0.01, height: Math.min(field.step, terrain.length - y) + 0.01 };
}

function elevationLayer(terrain: Terrain, field: Field): SVGGElement {
  const g = s('g', { 'shape-rendering': 'crispEdges', class: 'tv-layer' });
  const span = field.max - field.min || 1;
  for (let r = 0; r < field.rows; r++) {
    for (let c = 0; c < field.cols; c++) {
      const e = field.nodes[r]?.[c] ?? 0;
      const band = Math.min(ELEVATION_BANDS.length - 1, Math.floor(((e - field.min) / span) * ELEVATION_BANDS.length));
      g.append(s('rect', { ...cellRect(terrain, field, r, c), fill: ELEVATION_BANDS[band] ?? ELEVATION_BANDS[0] }));
    }
  }
  return g;
}

function slopeLayer(terrain: Terrain, field: Field): SVGGElement {
  const g = s('g', { 'shape-rendering': 'crispEdges', class: 'tv-layer tv-slope' });
  for (let r = 0; r < field.rows; r++) {
    for (let c = 0; c < field.cols; c++) {
      const rect = cellRect(terrain, field, r, c);
      const slope = slopeAt(terrain, rect.x + rect.width / 2, rect.y + rect.height / 2);
      const cls = SLOPE_CLASSES.find((k) => slope < k.max) ?? SLOPE_CLASSES[SLOPE_CLASSES.length - 1];
      g.append(s('rect', { ...rect, fill: cls?.color ?? '#F2C94C' }));
    }
  }
  return g;
}

function interpolate(a: number, b: number, level: number): number {
  return a === b ? 0.5 : (level - a) / (b - a);
}

function contourLayer(field: Field, interval: number): SVGGElement {
  const g = s('g', { class: 'tv-layer tv-contours' });
  const start = Math.ceil(field.min / interval) * interval;
  for (let level = start, index = 0; level <= field.max; level += interval, index++) {
    const segments: string[] = [];
    for (let r = 0; r < field.rows; r++) {
      for (let c = 0; c < field.cols; c++) {
        const tl = field.nodes[r]?.[c] ?? 0;
        const tr = field.nodes[r]?.[c + 1] ?? 0;
        const br = field.nodes[r + 1]?.[c + 1] ?? 0;
        const bl = field.nodes[r + 1]?.[c] ?? 0;
        const x = c * field.step;
        const y = r * field.step;
        const st = field.step;
        const points: Array<[number, number]> = [];
        if ((tl < level) !== (tr < level)) points.push([x + st * interpolate(tl, tr, level), y]);
        if ((tr < level) !== (br < level)) points.push([x + st, y + st * interpolate(tr, br, level)]);
        if ((bl < level) !== (br < level)) points.push([x + st * interpolate(bl, br, level), y + st]);
        if ((tl < level) !== (bl < level)) points.push([x, y + st * interpolate(tl, bl, level)]);
        for (let i = 0; i + 1 < points.length; i += 2) {
          const [a, b] = [points[i], points[i + 1]];
          if (a && b) segments.push(`M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`);
        }
      }
    }
    if (segments.length) g.append(s('path', { d: segments.join(''), class: index % 5 === 0 ? 'tv-contour major' : 'tv-contour' }));
  }
  return g;
}

function gridLayer(terrain: Terrain): SVGGElement {
  const g = s('g', { class: 'tv-layer tv-grid' });
  for (let x = 2; x < terrain.width; x += 2) g.append(s('line', { x1: x, y1: 0, x2: x, y2: terrain.length }));
  for (let y = 2; y < terrain.length; y += 2) g.append(s('line', { x1: 0, y1: y, x2: terrain.width, y2: y }));
  return g;
}

function setbackLayer(project: Project): SVGGElement {
  const { terrain, building } = project;
  const g = s('g', { class: 'tv-layer tv-setbacks' });
  const sx = building.setbackX;
  const sy = building.setbackY;
  g.append(
    s('rect', { class: 'tv-setback-area', x: 0, y: 0, width: terrain.width, height: sy }),
    s('line', { class: 'tv-setback-line', x1: 0, y1: sy, x2: terrain.width, y2: sy }),
    s('line', { class: 'tv-setback-line', x1: sx, y1: sy, x2: sx, y2: terrain.length }),
    s('text', { class: 'tv-text', x: terrain.width - 0.3, y: sy / 2 + 0.25, 'text-anchor': 'end' }, `Retiro frontal ${formatNumber(sy, 1)} m`),
  );
  if (sx > 0.2) g.append(s('text', { class: 'tv-text', x: sx / 2, y: sy + 1.4, 'text-anchor': 'middle' }, `${formatNumber(sx, 1)}`));
  return g;
}

function zonesLayer(project: Project): SVGGElement {
  const zones = siteZones(project);
  const g = s('g', { class: 'tv-layer' });
  if (zones.backYard.depth > 0.5) {
    const z = zones.backYard;
    g.append(s('rect', { class: 'tv-zone-garden', x: z.x, y: z.y, width: z.width, height: z.depth }),
      s('text', { class: 'tv-text', x: 0.4, y: z.y + z.depth - 0.4 }, `Jardín · ${formatNumber(project.terrain.gardenArea)} m²`));
  }
  if (zones.parking) {
    const z = zones.parking;
    g.append(s('rect', { class: 'tv-zone-parking', x: z.x, y: z.y, width: z.width, height: z.depth }),
      s('text', { class: 'tv-text', x: z.x + z.width / 2, y: z.y + z.depth / 2 + 0.25, 'text-anchor': 'middle' }, 'Estacionamiento'));
  }
  if (zones.pool) {
    const z = zones.pool;
    g.append(s('rect', { class: 'tv-zone-pool', x: z.x, y: z.y, width: z.width, height: z.depth, rx: 0.3 }));
  }
  return g;
}

function footprintLayer(project: Project): SVGGElement {
  const { building } = project;
  const g = s('g', { class: 'tv-layer' });
  building.floors.forEach((floor, index) => {
    const x = building.setbackX + floor.footprint.x;
    const y = building.setbackY + floor.footprint.y;
    g.append(s('rect', { class: index === 0 ? 'tv-footprint' : 'tv-footprint upper', x, y, width: floor.footprint.width, height: floor.footprint.depth }));
  });
  const ground = building.floors[0];
  if (ground) {
    const x = building.setbackX + ground.footprint.x + ground.footprint.width / 2;
    const y = building.setbackY + ground.footprint.y + ground.footprint.depth / 2;
    g.append(
      s('text', { class: 'tv-text strong', x, y, 'text-anchor': 'middle' }, 'HUELLA'),
      s('text', { class: 'tv-text', x, y: y + 0.8, 'text-anchor': 'middle' }, `${formatNumber(ground.footprint.width * ground.footprint.depth)} m²`),
    );
  }
  return g;
}

function sunLayer(terrain: Terrain, monthIndex: number, hour: number): SVGGElement {
  const g = s('g', { class: 'tv-layer tv-sun' });
  const cx = terrain.width / 2;
  const cy = terrain.length / 2;
  const radius = Math.max(terrain.width, terrain.length) * 0.46;
  const rotation = ORIENTATION_DEG[terrain.orientation];
  const project = (azimuth: number, altitude: number) => {
    const theta = ((azimuth - rotation) * Math.PI) / 180;
    const r = radius * (1 - Math.max(0, altitude) / 90);
    return { x: cx + Math.sin(theta) * r, y: cy - Math.cos(theta) * r };
  };
  const path = sunPath(terrain.latitude, monthIndex);
  if (!path.length) return g;
  g.append(s('circle', { class: 'tv-sun-ring', cx, cy, r: radius }));
  g.append(s('path', { class: 'tv-sun-path', d: path.map((p, i) => { const q = project(p.azimuth, p.altitude); return `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`; }).join('') }));
  for (const p of path) {
    const q = project(p.azimuth, p.altitude);
    g.append(s('circle', { class: 'tv-sun-dot', cx: q.x, cy: q.y, r: 0.18 }));
    if (p.hour % 3 === 0) g.append(s('text', { class: 'tv-text', x: q.x, y: q.y - 0.35, 'text-anchor': 'middle' }, `${p.hour}h`));
  }
  const current = path.reduce((best, p) => (Math.abs(p.hour - hour) < Math.abs(best.hour - hour) ? p : best), path[0] ?? { hour, altitude: 0, azimuth: 0 });
  const q = project(current.azimuth, current.altitude);
  g.append(s('circle', { class: 'tv-sun-current', cx: q.x, cy: q.y, r: 0.42 }));
  return g;
}

function northArrow(terrain: Terrain): SVGGElement {
  return s('g', { class: 'tv-north', transform: `translate(${terrain.width + 1.4} 1.4)` },
    s('circle', { r: 0.9 }),
    s('path', { d: 'M0 -0.75 L0.32 0.4 L0 0.18 L-0.32 0.4 Z', transform: `rotate(${-ORIENTATION_DEG[terrain.orientation]})` }),
    s('text', { class: 'tv-text strong', y: 1.75, 'text-anchor': 'middle' }, 'N'));
}

export interface TerrainLayerOptions {
  layers: ReadonlySet<TerrainLayerId>;
  sunMonth: number;
  sunHour: number;
  contourInterval: number;
}

export function drawTerrainLayers(project: Project, options: TerrainLayerOptions): SVGSVGElement {
  const { terrain } = project;
  const field = sampleField(terrain);
  const on = (id: TerrainLayerId) => options.layers.has(id);
  const svg = s('svg', {
    class: 'tv-svg',
    viewBox: `-1.6 -1.6 ${terrain.width + 4.4} ${terrain.length + 3.4}`,
    role: 'img',
    'aria-label': 'Visor del terreno por capas',
  });
  svg.append(s('rect', { class: 'tv-base', x: 0, y: 0, width: terrain.width, height: terrain.length }));
  if (on('elevation')) svg.append(elevationLayer(terrain, field));
  if (on('slope')) svg.append(slopeLayer(terrain, field));
  if (on('grid')) svg.append(gridLayer(terrain));
  if (on('contours')) svg.append(contourLayer(field, options.contourInterval));
  if (on('zones')) svg.append(zonesLayer(project));
  if (on('setbacks')) svg.append(setbackLayer(project));
  if (on('footprint')) svg.append(footprintLayer(project));
  if (on('sun')) svg.append(sunLayer(terrain, options.sunMonth, options.sunHour));
  svg.append(
    s('rect', { class: 'tv-lot', x: 0, y: 0, width: terrain.width, height: terrain.length }),
    s('text', { class: 'tv-text strong', x: terrain.width / 2, y: -0.55, 'text-anchor': 'middle' }, `FRENTE · ${formatNumber(terrain.width, 1)} m`),
    s('text', { class: 'tv-text strong', x: -0.55, y: terrain.length / 2, 'text-anchor': 'middle', transform: `rotate(-90 -0.55 ${terrain.length / 2})` }, `${formatNumber(terrain.length, 1)} m`),
    northArrow(terrain),
  );
  return svg;
}

export function contourIntervalFor(terrain: Terrain): number {
  const drop = (terrain.slopePercent / 100) * terrain.length;
  if (drop > 6) return 1;
  if (drop > 3) return 0.5;
  if (drop > 1.2) return 0.25;
  return 0.1;
}
