import { h, s } from '../core/dom';

export interface Datum {
  label: string;
  value: number;
}

interface ChartFrame {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
}

const FRAME: ChartFrame = { width: 320, height: 150, pad: { top: 14, right: 10, bottom: 22, left: 36 } };
const WIDE_FRAME: ChartFrame = { ...FRAME, width: 560, pad: { ...FRAME.pad, left: 44 } };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((st) => span / st <= count) ?? step * 10;
  const start = Math.floor(min / nice) * nice;
  const end = Math.ceil(max / nice) * nice;
  const ticks: number[] = [];
  for (let t = start; t <= end + nice * 0.001; t += nice) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

function wrapper(svg: SVGSVGElement, tooltip: HTMLElement, caption: string): HTMLElement {
  return h('figure', { class: 'chart' }, h('div', { class: 'chart-stage' }, svg, tooltip), h('figcaption', { class: 'chart-caption' }, caption));
}

function placeTooltip(tooltip: HTMLElement, svg: SVGSVGElement, x: number, y: number, html: string): void {
  const box = svg.getBoundingClientRect();
  const k = box.width / svg.viewBox.baseVal.width;
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const left = Math.min(box.width - tooltip.offsetWidth - 4, Math.max(4, x * k - tooltip.offsetWidth / 2));
  tooltip.style.transform = `translate(${left}px, ${Math.max(0, y * k - tooltip.offsetHeight - 10)}px)`;
}

export function lineChart(data: readonly Datum[], opts: { caption: string; unit: string; format: (v: number) => string }): HTMLElement {
  const { width, height, pad } = WIDE_FRAME;
  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0] ?? 0;
  const yMax = ticks.at(-1) ?? 1;
  const x = (i: number) => pad.left + (i / Math.max(1, data.length - 1)) * (width - pad.left - pad.right);
  const y = (v: number) => height - pad.bottom - ((v - yMin) / (yMax - yMin || 1)) * (height - pad.top - pad.bottom);

  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': opts.caption });
  for (const t of ticks) {
    svg.append(
      s('line', { class: 'chart-grid', x1: pad.left, x2: width - pad.right, y1: y(t), y2: y(t) }),
      s('text', { class: 'chart-tick', x: pad.left - 6, y: y(t) + 3, 'text-anchor': 'end' }, opts.format(t)),
    );
  }
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  svg.append(
    s('path', { class: 'chart-area', d: `${line} L${x(data.length - 1)} ${height - pad.bottom} L${x(0)} ${height - pad.bottom} Z` }),
    s('path', { class: 'chart-line', d: line }),
    s('line', { class: 'chart-axis', x1: pad.left, x2: width - pad.right, y1: height - pad.bottom, y2: height - pad.bottom }),
  );
  [0, Math.floor((data.length - 1) / 2), data.length - 1].forEach((i) => {
    const d = data[i];
    if (d) svg.append(s('text', { class: 'chart-tick', x: x(i), y: height - 6, 'text-anchor': i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle' }, d.label));
  });

  const cross = s('line', { class: 'chart-cross', y1: pad.top, y2: height - pad.bottom, visibility: 'hidden' });
  const dot = s('circle', { class: 'chart-dot', r: 4, visibility: 'hidden' });
  const hit = s('rect', { x: pad.left, y: pad.top, width: width - pad.left - pad.right, height: height - pad.top - pad.bottom, fill: 'transparent' });
  svg.append(cross, dot, hit);
  const tooltip = h('div', { class: 'chart-tooltip', hidden: true });

  hit.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * width;
    const i = Math.round(((px - pad.left) / (width - pad.left - pad.right)) * (data.length - 1));
    const d = data[Math.min(data.length - 1, Math.max(0, i))];
    if (!d) return;
    const xi = x(data.indexOf(d));
    cross.setAttribute('x1', String(xi));
    cross.setAttribute('x2', String(xi));
    dot.setAttribute('cx', String(xi));
    dot.setAttribute('cy', String(y(d.value)));
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('visibility', 'visible');
    placeTooltip(tooltip, svg, xi, y(d.value), `<span>${d.label}</span><strong>${opts.format(d.value)} ${opts.unit}</strong>`);
  });
  hit.addEventListener('pointerleave', () => {
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    tooltip.hidden = true;
  });
  return wrapper(svg, tooltip, opts.caption);
}

export function columnChart(
  data: readonly Datum[],
  opts: { caption: string; unit: string; format: (v: number) => string; highlight?: number; onSelect?: (index: number) => void; directLabels?: boolean },
): HTMLElement {
  const { width, height, pad } = FRAME;
  const ticks = niceTicks(0, Math.max(...data.map((d) => d.value)));
  const yMax = ticks.at(-1) ?? 1;
  const plotW = width - pad.left - pad.right;
  const band = plotW / data.length;
  const barW = Math.min(28, band - 2);
  const y = (v: number) => height - pad.bottom - (v / yMax) * (height - pad.top - pad.bottom);

  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': opts.caption });
  for (const t of ticks) {
    svg.append(
      s('line', { class: 'chart-grid', x1: pad.left, x2: width - pad.right, y1: y(t), y2: y(t) }),
      s('text', { class: 'chart-tick', x: pad.left - 6, y: y(t) + 3, 'text-anchor': 'end' }, opts.format(t)),
    );
  }
  const tooltip = h('div', { class: 'chart-tooltip', hidden: true });
  data.forEach((d, i) => {
    const cx = pad.left + band * i + band / 2;
    const top = y(d.value);
    const barH = height - pad.bottom - top;
    const r = Math.min(4, barW / 2, barH);
    const x0 = cx - barW / 2;
    const base = height - pad.bottom;
    const path = `M${x0} ${base} V${top + r} Q${x0} ${top} ${x0 + r} ${top} H${x0 + barW - r} Q${x0 + barW} ${top} ${x0 + barW} ${top + r} V${base} Z`;
    const bar = s('path', { class: `chart-bar${opts.highlight === i ? ' is-active' : ''}`, d: path });
    const hit = s('rect', { x: pad.left + band * i, y: pad.top, width: band, height: height - pad.top - pad.bottom, fill: 'transparent', class: opts.onSelect ? 'chart-hit clickable' : 'chart-hit' });
    hit.addEventListener('pointerenter', () => {
      bar.classList.add('is-hover');
      placeTooltip(tooltip, svg, cx, top, `<span>${d.label}</span><strong>${opts.format(d.value)} ${opts.unit}</strong>`);
    });
    hit.addEventListener('pointerleave', () => {
      bar.classList.remove('is-hover');
      tooltip.hidden = true;
    });
    if (opts.onSelect) hit.addEventListener('click', () => opts.onSelect?.(i));
    svg.append(bar, s('text', { class: 'chart-tick', x: cx, y: height - 7, 'text-anchor': 'middle' }, d.label));
    if (opts.directLabels) svg.append(s('text', { class: 'chart-value', x: cx, y: top - 4, 'text-anchor': 'middle' }, opts.format(d.value)));
    svg.append(hit);
  });
  svg.append(s('line', { class: 'chart-axis', x1: pad.left, x2: width - pad.right, y1: height - pad.bottom, y2: height - pad.bottom }));
  return wrapper(svg, tooltip, opts.caption);
}
