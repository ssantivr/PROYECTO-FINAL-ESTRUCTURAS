import { formatNumber, s } from '../core/dom';
import type { Opening, Project } from '../types/project';
import { roofRise } from '../services/metrics';
import { elevationAt } from '../services/terrainAnalysis';

export type ElevationKind = 'front' | 'side' | 'section';

const PAD = 2.5;
const SLAB = 0.2;

/** Converts building coordinates (m, y up) to SVG coordinates (y down). */
const flip = (top: number) => (y: number) => top - y;

function levelMark(x: number, y: number, label: string): SVGGElement {
  return s('g', { class: 'level-mark' },
    s('path', { class: 'level-symbol', d: `M${x} ${y} l0.25 -0.3 h-0.5 z` }),
    s('line', { class: 'dim-line', x1: x - 0.4, y1: y, x2: x + 1.6, y2: y }),
    s('text', { class: 'dim-text', x: x + 0.3, y: y - 0.12 }, label));
}

function openingRects(list: readonly Opening[], baseY: number, fy: (y: number) => number, fromX: (o: Opening) => number): SVGElement[] {
  return list.map((o) => {
    const x = fromX(o);
    const y = fy(baseY + o.sill + o.height);
    const g = s('g', {}, s('rect', { class: o.kind === 'door' ? 'elev-door' : 'elev-window', x, y, width: o.width, height: o.height }));
    if (o.kind === 'window') g.append(s('line', { class: 'elev-mullion', x1: x + o.width / 2, y1: y, x2: x + o.width / 2, y2: y + o.height }));
    return g;
  });
}

export function drawElevation(project: Project, kind: ElevationKind): SVGSVGElement {
  const { building, terrain } = project;
  const [ground, upper] = building.floors;
  const top = building.floors.at(-1);
  if (!ground || !top) return s('svg', {});
  const { overhang } = building.roof;
  const eave = top.level + top.height;
  const ridge = eave + roofRise(project);
  const horizontal = kind === 'front';
  const span = horizontal ? ground.footprint.width : ground.footprint.depth;
  const cx = building.setbackX + ground.footprint.width / 2;
  const cz = building.setbackY + ground.footprint.depth / 2;
  const base = elevationAt(terrain, cx, cz);
  const skyTop = ridge + 1.2;
  const fy = flip(skyTop);
  const width = span + PAD * 2 + 2;
  const height = skyTop + 2.2;

  const svg = s('svg', { class: 'elev-svg', viewBox: `${-PAD} 0 ${width} ${height}`, role: 'img', 'aria-label': kind === 'front' ? 'Fachada principal' : kind === 'side' ? 'Fachada lateral' : 'Corte A-A' });
  const g = s('g', {});

  // Natural terrain line.
  const samples = 30;
  const from = -PAD;
  const to = span + PAD;
  const terrainPts = Array.from({ length: samples + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / samples;
    const rel = horizontal
      ? elevationAt(terrain, building.setbackX + t, building.setbackY) - base
      : elevationAt(terrain, cx, building.setbackY + t) - base;
    return `${t.toFixed(2)} ${fy(rel).toFixed(2)}`;
  });
  g.append(s('path', { class: 'elev-ground', d: `M${terrainPts.join(' L')} L${to} ${height} L${from} ${height} Z` }));

  if (kind === 'section') {
    const depth = ground.footprint.depth;
    const up = upper?.footprint;
    const upY0 = up ? up.y : 0;
    const upY1 = up ? up.y + up.depth : depth;
    g.append(
      s('rect', { class: 'section-space', x: 0, y: fy(eave), width: depth, height: eave }),
      s('rect', { class: 'section-cut', x: -0.25, y: fy(ground.height), width: 0.25, height: ground.height + SLAB }),
      s('rect', { class: 'section-cut', x: depth, y: fy(ground.height), width: 0.25, height: ground.height + SLAB }),
      s('rect', { class: 'section-cut', x: -0.25, y: fy(0), width: depth + 0.5, height: SLAB }),
      s('rect', { class: 'section-cut', x: -0.25, y: fy(ground.height), width: depth + 0.5, height: SLAB }),
    );
    if (upper) {
      g.append(
        s('rect', { class: 'section-cut', x: upY0 - 0.25, y: fy(eave), width: 0.25, height: upper.height }),
        s('rect', { class: 'section-cut', x: upY1, y: fy(eave), width: 0.25, height: upper.height }),
        s('rect', { class: 'section-cut', x: upY0 - 0.25, y: fy(eave), width: upY1 - upY0 + 0.5, height: SLAB }),
      );
    }
    g.append(s('path', { class: 'section-roof', d: `M${upY0 - overhang} ${fy(eave)} L${(upY0 + upY1) / 2} ${fy(ridge)} L${upY1 + overhang} ${fy(eave)}` }));
    // Interior partition cut at the living/study boundary.
    const partition = ground.rooms.find((r) => r.y > 0)?.y;
    if (partition !== undefined) g.append(s('rect', { class: 'section-cut', x: partition - 0.06, y: fy(ground.height), width: 0.12, height: ground.height }));
    g.append(s('text', { class: 'plan-title', x: 0, y: height - 0.5 }, 'CORTE A-A'));
  } else {
    const floorX = (f: typeof ground) => (horizontal ? f.footprint.x : f.footprint.y);
    const floorW = (f: typeof ground) => (horizontal ? f.footprint.width : f.footprint.depth);
    building.floors.forEach((floor, i) => {
      g.append(s('rect', { class: i === 0 ? 'elev-wall' : 'elev-wall upper', x: floorX(floor), y: fy(floor.level + floor.height), width: floorW(floor), height: floor.height }));
      const openings = horizontal ? floor.openings.front : floor.openings.right;
      g.append(...openingRects(openings, floor.level, fy, (o) => floorX(floor) + o.offset));
      if (i > 0) g.append(s('rect', { class: 'elev-slab', x: floorX(floor) - 0.1, y: fy(floor.level) - 0.1, width: floorW(floor) + 0.2, height: 0.2 }));
    });
    const tx = floorX(top);
    const tw = floorW(top);
    g.append(horizontal
      ? s('rect', { class: 'elev-roof', x: tx - overhang, y: fy(ridge), width: tw + overhang * 2, height: ridge - eave })
      : s('path', { class: 'elev-roof', d: `M${tx - overhang} ${fy(eave)} L${tx + tw / 2} ${fy(ridge)} L${tx + tw + overhang} ${fy(eave)} Z` }));
    g.append(s('text', { class: 'plan-title', x: 0, y: height - 0.5 }, horizontal ? 'FACHADA PRINCIPAL' : 'FACHADA LATERAL DERECHA'));
  }

  const lx = span + 0.6;
  g.append(
    levelMark(lx, fy(0), 'N+0.00'),
    ...building.floors.slice(1).map((f) => levelMark(lx, fy(f.level), `N+${f.level.toFixed(2)}`)),
    levelMark(lx, fy(eave), `N+${eave.toFixed(2)}`),
    levelMark(lx, fy(ridge), `N+${ridge.toFixed(2)}`),
    s('text', { class: 'room-area', x: span, y: height - 0.5, 'text-anchor': 'end' }, `Altura total ${formatNumber(ridge, 2)} m`),
  );
  svg.append(g);
  return svg;
}
