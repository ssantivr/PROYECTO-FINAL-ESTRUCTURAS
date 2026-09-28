import { formatNumber, s } from '../core/dom';
import type { FacadeSide, Floor, Opening, Project, Room } from '../types/project';

const EXT_WALL = 0.25;
const INT_WALL = 0.12;
const MARGIN = 3.2;
const EPS = 1e-6;

const unique = (values: number[]): number[] =>
  [...new Set(values.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);

function roomInner(room: Room, floor: Floor): { x: number; y: number; w: number; d: number } {
  const { width, depth } = floor.footprint;
  const left = room.x < EPS ? EXT_WALL : INT_WALL / 2;
  const top = room.y < EPS ? EXT_WALL : INT_WALL / 2;
  const right = Math.abs(room.x + room.width - width) < EPS ? EXT_WALL : INT_WALL / 2;
  const bottom = Math.abs(room.y + room.depth - depth) < EPS ? EXT_WALL : INT_WALL / 2;
  return { x: room.x + left, y: room.y + top, w: room.width - left - right, d: room.depth - top - bottom };
}

function openingShape(side: FacadeSide, o: Opening, floor: Floor): SVGGElement {
  const { width, depth } = floor.footprint;
  const g = s('g', {});
  let x = 0;
  let y = 0;
  let w = 0;
  let d = 0;
  switch (side) {
    case 'front': [x, y, w, d] = [o.offset, 0, o.width, EXT_WALL]; break;
    case 'back': [x, y, w, d] = [width - o.offset - o.width, depth - EXT_WALL, o.width, EXT_WALL]; break;
    case 'left': [x, y, w, d] = [0, depth - o.offset - o.width, EXT_WALL, o.width]; break;
    case 'right': [x, y, w, d] = [width - EXT_WALL, o.offset, EXT_WALL, o.width]; break;
  }
  g.append(s('rect', { class: 'opening', x, y, width: w, height: d }));
  if (o.kind === 'window') {
    const horizontal = side === 'front' || side === 'back';
    g.append(horizontal
      ? s('line', { class: 'opening', x1: x, y1: y + d / 2, x2: x + w, y2: y + d / 2 })
      : s('line', { class: 'opening', x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + d }));
  } else if (side === 'front') {
    const r = o.width;
    g.append(s('path', { class: 'door-swing', d: `M${x} ${d} L${x} ${d + r} A${r} ${r} 0 0 0 ${x + r} ${d}` }));
  } else if (side === 'back') {
    const r = o.width;
    g.append(s('path', { class: 'door-swing', d: `M${x + w} ${y} L${x + w} ${y - r} A${r} ${r} 0 0 0 ${x} ${y}` }));
  }
  return g;
}

function stairs(room: Room, floor: Floor): SVGGElement {
  const inner = roomInner(room, floor);
  const g = s('g', {});
  const steps = 11;
  for (let i = 1; i < steps; i++) {
    const y = inner.y + (inner.d * i) / steps;
    g.append(s('line', { class: 'stair-step', x1: inner.x, y1: y, x2: inner.x + inner.w, y2: y }));
  }
  g.append(s('line', { class: 'stair-step', x1: inner.x + inner.w / 2, y1: inner.y + inner.d - 0.2, x2: inner.x + inner.w / 2, y2: inner.y + 0.4, 'marker-end': 'url(#arrow)' }));
  return g;
}

type Inner = ReturnType<typeof roomInner>;

const box = (x: number, y: number, w: number, d: number, rx = 0.05) => s('rect', { class: 'furniture', x, y, width: w, height: d, rx });

function furniture(room: Room, inner: Inner): SVGGElement | null {
  const g = s('g', { class: 'furniture-group', 'aria-hidden': 'true' });
  const { x, y, w, d } = inner;
  const name = room.name.toLowerCase();
  const fits = (fw: number, fd: number) => fw < w - 0.3 && fd < d - 0.3;

  if (/hab/.test(name)) {
    const bw = name.includes('principal') ? 1.6 : 1.0;
    if (!fits(bw + 0.8, 2.1)) return null;
    const bx = x + (w - bw) / 2;
    g.append(box(bx, y + 0.15, bw, 2), box(bx + 0.1, y + 0.25, bw - 0.2, 0.4), box(bx - 0.5, y + 0.15, 0.4, 0.4), box(x + w - 0.75, y + d - 0.65, 0.6, 0.5));
  } else if (/sala|estar/.test(name)) {
    if (!fits(2.2, 2.2)) return null;
    g.append(box(x + 0.25, y + d - 1.15, 2.1, 0.85), box(x + 0.6, y + d - 2.1, 1.2, 0.6), box(x + w - 0.9, y + d - 1.8, 0.75, 0.75));
  } else if (/comedor/.test(name)) {
    if (!fits(1.8, 1.8)) return null;
    const tx = x + w / 2 - 0.8;
    const ty = y + d / 2 - 0.45;
    g.append(box(tx, ty, 1.6, 0.9));
    for (const cx of [tx + 0.2, tx + 0.95]) g.append(box(cx, ty - 0.5, 0.45, 0.4), box(cx, ty + 1.0, 0.45, 0.4));
  } else if (/cocina|cocineta/.test(name)) {
    if (!fits(1.2, 0.8)) return null;
    g.append(box(x + 0.05, y + 0.05, w - 0.1, 0.6, 0), s('circle', { class: 'furniture', cx: x + w * 0.3, cy: y + 0.35, r: 0.15 }), s('circle', { class: 'furniture', cx: x + w * 0.3 + 0.4, cy: y + 0.35, r: 0.15 }), box(x + w * 0.65, y + 0.12, 0.6, 0.45));
  } else if (/baño/.test(name)) {
    if (!fits(0.9, 1.1)) return null;
    g.append(s('ellipse', { class: 'furniture', cx: x + 0.45, cy: y + d - 0.5, rx: 0.22, ry: 0.3 }), box(x + w - 0.7, y + 0.1, 0.55, 0.45), box(x + 0.1, y + 0.1, Math.min(0.9, w - 0.9), 0.9));
  } else if (/garaje|parqueadero/.test(name)) {
    if (!fits(2.0, 4.5)) return null;
    g.append(box(x + (w - 1.8) / 2, y + (d - 4.3) / 2, 1.8, 4.3, 0.35));
  } else if (/lavander/.test(name)) {
    if (!fits(0.7, 0.7)) return null;
    g.append(box(x + 0.1, y + 0.1, 0.6, 0.6), box(x + 0.8, y + 0.1, Math.min(0.6, w - 0.9), 0.6));
  } else if (/estudio|oficina/.test(name)) {
    if (!fits(1.4, 1.2)) return null;
    g.append(box(x + 0.15, y + 0.15, 1.4, 0.65), box(x + 0.6, y + 0.9, 0.5, 0.5));
  } else {
    return null;
  }
  return g;
}

function dimension(x1: number, y1: number, x2: number, y2: number, label: string, vertical = false): SVGGElement {
  const tick = 0.18;
  const g = s('g', {});
  g.append(s('line', { class: 'dim-line', x1, y1, x2, y2 }));
  for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
    g.append(s('line', { class: 'dim-line', x1: px - tick, y1: py + tick, x2: px + tick, y2: py - tick }));
  }
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  g.append(vertical
    ? s('text', { class: 'dim-text', x: mx - 0.15, y: my, 'text-anchor': 'middle', transform: `rotate(-90 ${mx - 0.15} ${my})` }, label)
    : s('text', { class: 'dim-text', x: mx, y: my - 0.15, 'text-anchor': 'middle' }, label));
  return g;
}

function axisBubble(x: number, y: number, label: string): SVGGElement {
  return s('g', {},
    s('circle', { class: 'axis-bubble', cx: x, cy: y, r: 0.38 }),
    s('text', { class: 'axis-text', x, y: y + 0.12, 'text-anchor': 'middle' }, label));
}

export function drawFloorPlan(floor: Floor, offsetX = 0, offsetY = 0): SVGGElement {
  const { width, depth } = floor.footprint;
  const root = s('g', { class: 'floor-plan', 'data-floor': floor.id, transform: `translate(${offsetX} ${offsetY})` });

  const xs = unique(floor.rooms.flatMap((r) => [r.x, r.x + r.width]));
  const ys = unique(floor.rooms.flatMap((r) => [r.y, r.y + r.depth]));
  const axes = s('g', {});
  xs.forEach((x, i) => {
    axes.append(s('line', { class: 'axis-line', x1: x, y1: -2.4, x2: x, y2: depth + 0.6 }), axisBubble(x, -2.8, String.fromCharCode(65 + i)));
  });
  ys.forEach((y, i) => {
    axes.append(s('line', { class: 'axis-line', x1: -2.4, y1: y, x2: width + 0.6, y2: y }), axisBubble(-2.8, y, String(i + 1)));
  });

  const walls = s('rect', { class: 'wall', x: 0, y: 0, width, height: depth });
  const rooms = s('g', {});
  for (const room of floor.rooms) {
    const inner = roomInner(room, floor);
    rooms.append(s('rect', { class: 'room', x: inner.x, y: inner.y, width: inner.w, height: inner.d, 'data-room': room.id }));
    if (room.name === 'Escalera') rooms.append(stairs(room, floor));
    else {
      const cx = inner.x + inner.w / 2;
      const cy = inner.y + inner.d / 2;
      rooms.append(
        s('text', { class: inner.w < 1.7 ? 'room-label tiny' : inner.w < 2.6 ? 'room-label compact' : 'room-label', x: cx, y: cy, 'text-anchor': 'middle' }, room.name),
        s('text', { class: 'room-area', x: cx, y: cy + 0.45, 'text-anchor': 'middle' }, `${formatNumber(room.width * room.depth, 1)} m²`),
      );
      const items = furniture(room, inner);
      if (items) rooms.insertBefore(items, rooms.lastChild?.previousSibling ?? null);
    }
  }

  const openings = s('g', {});
  (Object.entries(floor.openings) as Array<[FacadeSide, Opening[]]>).forEach(([side, list]) =>
    list.forEach((o) => openings.append(openingShape(side, o, floor))));

  const dims = s('g', {});
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i] ?? 0;
    const b = xs[i + 1] ?? 0;
    dims.append(dimension(a, -0.8, b, -0.8, formatNumber(b - a, 2)));
  }
  dims.append(dimension(0, -1.6, width, -1.6, formatNumber(width, 2)));
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i] ?? 0;
    const b = ys[i + 1] ?? 0;
    dims.append(dimension(-0.8, a, -0.8, b, formatNumber(b - a, 2), true));
  }
  dims.append(dimension(-1.6, 0, -1.6, depth, formatNumber(depth, 2), true));

  root.append(axes, walls, rooms, openings, dims,
    s('text', { class: 'plan-title', x: 0, y: depth + 1.3 }, `${floor.name.toUpperCase()} · N+${floor.level.toFixed(2)}`),
    s('text', { class: 'room-area', x: 0, y: depth + 1.9 }, `Área ${formatNumber(width * depth, 1)} m² · Esc. gráfica 1:100`));
  return root;
}

function defs(): SVGDefsElement {
  return s('defs', {},
    s('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' },
      s('path', { d: 'M0 0 L10 5 L0 10 z', class: 'arrow-head' })));
}

export function drawPlanSheet(floors: readonly Floor[]): SVGSVGElement {
  let cursor = MARGIN;
  let maxDepth = 0;
  const groups = floors.map((floor) => {
    const g = drawFloorPlan(floor, cursor, MARGIN);
    cursor += floor.footprint.width + MARGIN + 0.8;
    maxDepth = Math.max(maxDepth, floor.footprint.depth);
    return g;
  });
  const width = cursor - 0.8 + 0.6;
  const height = maxDepth + MARGIN + 2.4;
  const svg = s('svg', { class: 'plan-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Plano: ${floors.map((f) => f.name).join(' y ')}` });
  svg.append(defs(), ...groups);
  return svg;
}

export function exportSheet(project: Project): SVGSVGElement {
  return drawPlanSheet(project.building.floors);
}
