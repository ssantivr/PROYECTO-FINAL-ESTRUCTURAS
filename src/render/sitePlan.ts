import { formatNumber, s } from '../core/dom';
import type { FacadeSide, Orientation, Project } from '../types/project';

const ORIENTATION_DEG: Record<Orientation, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

interface Zone {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export function siteZones(project: Project): { building: Zone | null; parking: Zone | null; pool: Zone | null; backYard: Zone } {
  const { terrain, building } = project;
  const ground = building.floors[0];
  const b = ground ? { x: building.setbackX + ground.footprint.x, y: building.setbackY + ground.footprint.y, width: ground.footprint.width, depth: ground.footprint.depth } : null;
  const backStart = b ? b.y + b.depth : 0;
  const backYard = { x: 0, y: backStart, width: terrain.width, depth: Math.max(0, terrain.length - backStart) };

  let parking: Zone | null = null;
  if (terrain.parkingArea > 0) {
    const front = b ? b.y : terrain.length;
    const inFront = front >= 2.8;
    const depth = Math.min(inFront ? front - 0.4 : backYard.depth - 0.4, 5.5);
    if (depth > 1) {
      const width = Math.min(terrain.parkingArea / depth, terrain.width - 0.6);
      parking = { x: 0.3, y: inFront ? 0.2 : backYard.y + 0.2, width, depth };
    }
  }

  let pool: Zone | null = null;
  if (terrain.poolArea > 0 && backYard.depth > 2) {
    const width = Math.min(Math.sqrt(terrain.poolArea * 2), terrain.width - 2);
    const depth = Math.min(terrain.poolArea / width, backYard.depth - 1.4);
    if (depth > 0.8) pool = { x: terrain.width - width - 1, y: backYard.y + (backYard.depth - depth) / 2 + 0.2, width, depth };
  }
  return { building: b, parking, pool, backYard };
}

function accessMarker(side: FacadeSide, w: number, l: number): SVGGElement {
  const pos: Record<FacadeSide, { x: number; y: number; rot: number }> = {
    front: { x: w / 2, y: -1.1, rot: 180 },
    back: { x: w / 2, y: l + 1.1, rot: 0 },
    left: { x: -1.1, y: l / 2, rot: 90 },
    right: { x: w + 1.1, y: l / 2, rot: -90 },
  };
  const { x, y, rot } = pos[side];
  return s('g', { class: 'site-access', transform: `translate(${x} ${y})` },
    s('path', { d: 'M0 -0.5 L0.45 0.2 L-0.45 0.2 Z', transform: `rotate(${rot})` }),
    s('text', { class: 'site-text strong', y: side === 'front' ? -0.55 : 1.05, 'text-anchor': 'middle' }, 'ACCESO'));
}

export function drawSitePlan(project: Project, detailed = true): SVGSVGElement {
  const { terrain } = project;
  const pad = detailed ? 3 : 2.2;
  const zones = siteZones(project);
  const svg = s('svg', {
    class: 'site-plan',
    viewBox: `${-pad} ${-pad} ${terrain.width + pad * 2} ${terrain.length + pad * 2}`,
    role: 'img',
    'aria-label': 'Plano de implantación',
  });

  svg.append(s('rect', { class: 'site-lot', x: 0, y: 0, width: terrain.width, height: terrain.length }));
  if (zones.backYard.depth > 0.5) {
    svg.append(
      s('rect', { class: 'site-garden', x: zones.backYard.x, y: zones.backYard.y, width: zones.backYard.width, height: zones.backYard.depth }),
      s('text', { class: 'site-text', x: 0.4, y: zones.backYard.y + zones.backYard.depth - 0.4 }, `Jardín ${formatNumber(terrain.gardenArea)} m²`),
    );
  }
  if (zones.parking) {
    const p = zones.parking;
    svg.append(
      s('rect', { class: 'site-parking', x: p.x, y: p.y, width: p.width, height: p.depth }),
      s('text', { class: 'site-text', x: p.x + p.width / 2, y: p.y + p.depth / 2 + 0.25, 'text-anchor': 'middle' }, `Estac. ${formatNumber(terrain.parkingArea)} m²`),
    );
  }
  if (zones.pool) {
    const p = zones.pool;
    svg.append(
      s('rect', { class: 'site-pool', x: p.x, y: p.y, width: p.width, height: p.depth, rx: 0.3 }),
      s('text', { class: 'site-text', x: p.x + p.width / 2, y: p.y + p.depth / 2 + 0.25, 'text-anchor': 'middle' }, 'Piscina'),
    );
  }
  if (zones.building) {
    const { x, y, width, depth } = zones.building;
    svg.append(
      s('rect', { class: 'site-building', x, y, width, height: depth }),
      s('text', { class: 'site-text strong', x: x + width / 2, y: y + depth / 2, 'text-anchor': 'middle' }, 'CONSTRUCCIÓN'),
      s('text', { class: 'site-text', x: x + width / 2, y: y + depth / 2 + 0.75, 'text-anchor': 'middle' }, `${formatNumber(width, 1)} × ${formatNumber(depth, 1)} m`),
      s('line', { class: 'site-dim', x1: x + width / 2, y1: 0, x2: x + width / 2, y2: y }),
      s('text', { class: 'site-text', x: x + width / 2 + 0.3, y: y / 2 + 0.3 }, `${formatNumber(y, 1)} m`),
    );
  }

  svg.append(
    s('text', { class: 'site-text strong', x: terrain.width / 2, y: terrain.length + 1.1, 'text-anchor': 'middle' }, `${formatNumber(terrain.width, 1)} m`),
    s('text', { class: 'site-text strong', x: terrain.width + 0.9, y: terrain.length / 2, 'text-anchor': 'middle', transform: `rotate(90 ${terrain.width + 0.9} ${terrain.length / 2})` }, `${formatNumber(terrain.length, 1)} m`),
    accessMarker(terrain.accessSide, terrain.width, terrain.length),
  );
  if (terrain.accessSide === 'front') {
    svg.append(s('line', { class: 'site-street', x1: -pad, y1: -0.2, x2: terrain.width + pad, y2: -0.2 }));
  }
  svg.append(
    s('g', { class: 'site-north', transform: `translate(${-pad + 1.1} ${terrain.length + pad - 1.6})` },
      s('path', { d: 'M0 -1.1 L0.45 0.5 L0 0.2 L-0.45 0.5 Z', transform: `rotate(${-ORIENTATION_DEG[terrain.orientation]})` }),
      s('text', { class: 'site-text', y: 1.3, 'text-anchor': 'middle' }, 'N')),
  );
  return svg;
}
