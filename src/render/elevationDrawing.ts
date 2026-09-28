import { formatNumber, s } from '../core/dom';
import type { FacadeSide, Floor, Opening, Project } from '../types/project';
import { roofRise } from '../services/metrics';
import { elevationAt } from '../services/terrainAnalysis';

export type ElevationKind = FacadeSide | 'section';

export const ELEVATION_TITLE: Record<ElevationKind, string> = {
  front: 'Fachada principal',
  back: 'Fachada posterior',
  left: 'Fachada lateral izquierda',
  right: 'Fachada lateral derecha',
  section: 'Corte esquemático A-A',
};

const PAD = 2.5;
const SLAB = 0.2;
const WALL = 0.25;

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

function facadeFrame(side: FacadeSide, floor: Floor, ground: Floor) {
  const { x, y, width, depth } = floor.footprint;
  switch (side) {
    case 'front': return { start: x, span: width, at: (o: Opening) => x + o.offset };
    case 'back': return { start: ground.footprint.width - x - width, span: width, at: (o: Opening) => ground.footprint.width - x - width + o.offset };
    case 'left': return { start: y, span: depth, at: (o: Opening) => y + depth - o.offset - o.width };
    case 'right': return { start: y, span: depth, at: (o: Opening) => y + o.offset };
  }
}

export function drawElevation(project: Project, kind: ElevationKind): SVGSVGElement {
  const { building, terrain } = project;
  const ground = building.floors[0];
  const top = building.floors.at(-1);
  if (!ground || !top) return s('svg', {});
  const { overhang } = building.roof;
  const eave = top.level + top.height;
  const ridge = eave + roofRise(project);
  const alongWidth = kind === 'front' || kind === 'back';
  const span = alongWidth ? ground.footprint.width : ground.footprint.depth;
  const cx = building.setbackX + ground.footprint.width / 2;
  const cz = building.setbackY + ground.footprint.depth / 2;
  const base = elevationAt(terrain, cx, cz);
  const skyTop = ridge + 1.2;
  const fy = flip(skyTop);
  const width = span + PAD * 2 + 2;
  const height = skyTop + 2.2;

  const svg = s('svg', { class: 'elev-svg', viewBox: `${-PAD} 0 ${width} ${height}`, role: 'img', 'aria-label': ELEVATION_TITLE[kind] });
  const g = s('g', {});

  const samples = 30;
  const from = -PAD;
  const to = span + PAD;
  const terrainPts = Array.from({ length: samples + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / samples;
    let rel: number;
    switch (kind) {
      case 'front': rel = elevationAt(terrain, building.setbackX + t, building.setbackY); break;
      case 'back': rel = elevationAt(terrain, building.setbackX + ground.footprint.width - t, building.setbackY + ground.footprint.depth); break;
      case 'left': rel = elevationAt(terrain, building.setbackX, building.setbackY + t); break;
      default: rel = elevationAt(terrain, kind === 'right' ? building.setbackX + ground.footprint.width : cx, building.setbackY + t);
    }
    return `${t.toFixed(2)} ${fy(rel - base).toFixed(2)}`;
  });
  g.append(s('path', { class: 'elev-ground', d: `M${terrainPts.join(' L')} L${to} ${height} L${from} ${height} Z` }));

  if (kind === 'section') {
    const cutX = ground.footprint.width / 2;
    building.floors.forEach((floor) => {
      const { y, depth, x, width: w } = floor.footprint;
      const localCut = cutX - x;
      g.append(
        s('rect', { class: 'section-space', x: y, y: fy(floor.level + floor.height), width: depth, height: floor.height }),
        s('rect', { class: 'section-cut', x: y - WALL, y: fy(floor.level + floor.height), width: WALL, height: floor.height }),
        s('rect', { class: 'section-cut', x: y + depth, y: fy(floor.level + floor.height), width: WALL, height: floor.height }),
        s('rect', { class: 'section-cut', x: y - WALL, y: fy(floor.level), width: depth + WALL * 2, height: SLAB }),
      );
      const crossed = floor.rooms.filter((r) => localCut >= r.x && localCut <= r.x + r.width && localCut <= w).sort((a, b) => a.y - b.y);
      crossed.forEach((room, i) => {
        if (i > 0) g.append(s('rect', { class: 'section-cut', x: y + room.y - 0.06, y: fy(floor.level + floor.height), width: 0.12, height: floor.height }));
        g.append(s('text', { class: room.depth < 2.2 ? 'room-label compact' : 'room-label', x: y + room.y + room.depth / 2, y: fy(floor.level + floor.height / 2), 'text-anchor': 'middle' }, room.name.toUpperCase()));
      });
    });
    const { y: ty, depth: td } = top.footprint;
    g.append(
      s('rect', { class: 'section-cut', x: ty - WALL, y: fy(eave), width: td + WALL * 2, height: SLAB }),
      s('path', { class: 'section-roof', d: `M${ty - overhang} ${fy(eave)} L${ty + td / 2} ${fy(ridge)} L${ty + td + overhang} ${fy(eave)}` }),
      s('text', { class: 'dim-text', x: ty + td / 2, y: fy(ridge) - 0.3, 'text-anchor': 'middle' }, 'CUBIERTA'),
      s('text', { class: 'dim-text', x: -PAD + 0.2, y: fy(-0.6) }, 'TERRENO'),
    );
  } else {
    building.floors.forEach((floor, i) => {
      const frame = facadeFrame(kind, floor, ground);
      g.append(s('rect', { class: i === 0 ? 'elev-wall' : 'elev-wall upper', x: frame.start, y: fy(floor.level + floor.height), width: frame.span, height: floor.height }));
      g.append(...openingRects(floor.openings[kind], floor.level, fy, frame.at));
      if (i > 0) g.append(s('rect', { class: 'elev-slab', x: frame.start - 0.1, y: fy(floor.level) - 0.1, width: frame.span + 0.2, height: 0.2 }));
    });
    const { start: tx, span: tw } = facadeFrame(kind, top, ground);
    g.append(alongWidth
      ? s('rect', { class: 'elev-roof', x: tx - overhang, y: fy(ridge), width: tw + overhang * 2, height: ridge - eave })
      : s('path', { class: 'elev-roof', d: `M${tx - overhang} ${fy(eave)} L${tx + tw / 2} ${fy(ridge)} L${tx + tw + overhang} ${fy(eave)} Z` }));
  }
  g.append(s('text', { class: 'plan-title', x: 0, y: height - 0.5 }, ELEVATION_TITLE[kind].toUpperCase()));

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
