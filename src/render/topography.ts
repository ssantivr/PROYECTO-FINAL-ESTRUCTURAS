import { formatNumber, h, s } from '../core/dom';
import type { Terrain } from '../types/project';
import { elevationAt } from '../services/terrainAnalysis';

const BANDS = ['#104281', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef', '#b7d3f6'] as const;

export function topographyMap(terrain: Terrain): HTMLElement {
  const step = Math.max(0.5, Math.min(terrain.width, terrain.length) / 30);
  const cols = Math.ceil(terrain.width / step);
  const rows = Math.ceil(terrain.length / step);
  const grid: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const e = elevationAt(terrain, (c + 0.5) * step, (r + 0.5) * step);
      row.push(e);
      min = Math.min(min, e);
      max = Math.max(max, e);
    }
    grid.push(row);
  }
  const span = max - min || 1;
  const bandOf = (e: number) => Math.min(BANDS.length - 1, Math.floor(((e - min) / span) * BANDS.length));

  const svg = s('svg', { class: 'topo-svg', viewBox: `-0.2 -0.2 ${terrain.width + 0.4} ${terrain.length + 0.4}`, role: 'img', 'aria-label': 'Mapa topográfico aproximado del lote' });
  const cells = s('g', { 'shape-rendering': 'crispEdges' });
  const contours = s('g', { class: 'topo-contour' });
  grid.forEach((row, r) => row.forEach((e, c) => {
    const band = bandOf(e);
    const x = c * step;
    const y = r * step;
    const w = Math.min(step, terrain.width - x);
    const d = Math.min(step, terrain.length - y);
    cells.append(s('rect', { x, y, width: w + 0.01, height: d + 0.01, fill: BANDS[band] ?? BANDS[0] },
      s('title', {}, `${formatNumber(terrain.elevation + e, 2)} m s. n. m. · (${formatNumber(x + w / 2, 1)}, ${formatNumber(y + d / 2, 1)}) m`)));
    const right = row[c + 1];
    const below = grid[r + 1]?.[c];
    if (right !== undefined && bandOf(right) !== band) contours.append(s('line', { x1: x + w, y1: y, x2: x + w, y2: y + d }));
    if (below !== undefined && bandOf(below) !== band) contours.append(s('line', { x1: x, y1: y + d, x2: x + w, y2: y + d }));
  }));
  svg.append(
    cells,
    contours,
    s('rect', { class: 'topo-lot', x: 0, y: 0, width: terrain.width, height: terrain.length }),
    s('text', { class: 'topo-label', x: terrain.width / 2, y: 0.9, 'text-anchor': 'middle' }, 'FRENTE'),
  );

  const legend = h('div', { class: 'topo-legend', 'aria-label': 'Leyenda de elevación' },
    ...BANDS.map((color, i) => h('span', { class: 'topo-key' },
      h('i', { style: `background:${color}` }),
      `${formatNumber(terrain.elevation + min + (span * i) / BANDS.length, 1)}`)),
    h('em', {}, 'm s. n. m.'));

  return h('figure', { class: 'chart topo' },
    h('div', { class: 'topo-stage' }, svg),
    legend,
    h('figcaption', { class: 'chart-caption' }, `Topografía aproximada · curvas cada ${formatNumber(span / BANDS.length, 2)} m · pase el cursor para ver la cota`));
}
