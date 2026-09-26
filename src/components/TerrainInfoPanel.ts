import { Component } from '../core/component';
import { formatNumber, h, icon, s } from '../core/dom';
import type { AppStore } from '../core/appState';
import type { Project } from '../types/project';
import { computeMetrics } from '../services/metrics';

const ORIENTATION_LABEL: Record<Project['terrain']['orientation'], string> = {
  N: 'Norte', NE: 'Nororiente', E: 'Oriente', SE: 'Suroriente', S: 'Sur', SW: 'Suroccidente', W: 'Occidente', NW: 'Noroccidente',
};

/** Azimuth the street front faces; the plan draws the street at the top. */
const ORIENTATION_DEG: Record<Project['terrain']['orientation'], number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

export class TerrainInfoPanel extends Component {
  private readonly body = h('div', { class: 'panel-body terrain-info' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'info' }));
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Información del terreno'), h('span', { class: 'badge' }, 'Lote urbano')), this.body);
    this.render();
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private render(): void {
    const { project } = this.store.get();
    const { terrain } = project;
    const m = computeMetrics(project);
    this.body.replaceChildren(
      h('div', { class: 'index-grid' },
        indexMeter('COS', 'Ocupación', m.cos, terrain.maxCos, m.cosCompliant),
        indexMeter('CUS', 'Utilización', m.cus, terrain.maxCus, m.cusCompliant),
      ),
      sitePlan(project),
      h('dl', { class: 'data-list' },
        row('Dimensiones', `${formatNumber(terrain.width, 1)} × ${formatNumber(terrain.length, 1)} m`),
        row('Área del lote', `${formatNumber(m.lotArea)} m²`),
        row('Huella construida', `${formatNumber(m.footprintArea)} m²`),
        row('Área libre', `${formatNumber(m.freeArea)} m²`),
        row('Pendiente media', `${formatNumber(terrain.slopePercent, 1)} %`),
        row('Desnivel', `${formatNumber((terrain.slopePercent / 100) * terrain.length, 2)} m`),
        row('Cota base', `${formatNumber(terrain.elevation)} m s. n. m.`),
        row('Orientación frente', ORIENTATION_LABEL[terrain.orientation]),
        row('Suelo', terrain.soilType),
        row('Pisos', `${project.building.floors.length} / ${terrain.maxFloors} permitidos`),
        row('Altura total', `${formatNumber(m.totalHeight, 2)} m`),
        row('Coordenadas', `${terrain.latitude.toFixed(4)}°, ${terrain.longitude.toFixed(4)}°`),
      ),
    );
  }
}

function row(label: string, value: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(h('dt', {}, label), h('dd', {}, value));
  return frag;
}

function indexMeter(code: string, label: string, value: number, max: number, ok: boolean): HTMLElement {
  const pct = Math.min(100, (value / max) * 100);
  return h('div', { class: 'index-card' },
    h('div', { class: 'index-top' },
      h('span', { class: 'index-code' }, code),
      h('span', { class: `status ${ok ? 'status-ok' : 'status-bad'}` }, icon(ok ? 'check' : 'spark', 12), ok ? 'Cumple' : 'Excede'),
    ),
    h('strong', { class: 'index-value' }, value.toFixed(2)),
    h('span', { class: 'index-label' }, `${label} · máx. ${max.toFixed(2)}`),
    h('div', { class: 'meter', role: 'meter', 'aria-valuenow': value.toFixed(2), 'aria-valuemax': max, 'aria-label': code },
      h('span', { class: 'meter-fill', style: `width:${pct}%` })),
  );
}

/** Implantation mini-plan: lot boundary, building footprint, setbacks and north. */
function sitePlan(project: Project): SVGSVGElement {
  const { terrain, building } = project;
  const pad = 2.2;
  const ground = building.floors[0];
  const svg = s('svg', { class: 'site-plan', viewBox: `${-pad} ${-pad} ${terrain.width + pad * 2} ${terrain.length + pad * 2}`, role: 'img', 'aria-label': 'Plano de implantación' });
  svg.append(
    s('rect', { class: 'site-lot', x: 0, y: 0, width: terrain.width, height: terrain.length }),
    s('line', { class: 'site-street', x1: -pad, y1: -0.9, x2: terrain.width + pad, y2: -0.9 }),
    s('text', { class: 'site-text', x: terrain.width / 2, y: -1.3, 'text-anchor': 'middle' }, 'VÍA DE ACCESO'),
  );
  if (ground) {
    const { x, y, width, depth } = ground.footprint;
    const bx = building.setbackX + x;
    const by = building.setbackY + y;
    svg.append(
      s('rect', { class: 'site-building', x: bx, y: by, width, height: depth }),
      s('text', { class: 'site-text strong', x: bx + width / 2, y: by + depth / 2 + 0.35, 'text-anchor': 'middle' }, `${formatNumber(width * depth)} m²`),
      s('line', { class: 'site-dim', x1: bx + width / 2, y1: 0, x2: bx + width / 2, y2: by }),
      s('text', { class: 'site-text', x: bx + width / 2 + 0.3, y: by / 2 + 0.3 }, `${formatNumber(by, 1)} m`),
      s('text', { class: 'site-text', x: terrain.width / 2, y: (by + depth + terrain.length) / 2 + 0.3, 'text-anchor': 'middle' }, 'Patio / jardín'),
    );
  }
  svg.append(
    s('g', { class: 'site-north', transform: `translate(${terrain.width + pad - 1.1} ${terrain.length + pad - 1.6})` },
      s('path', { d: 'M0 -1.1 L0.45 0.5 L0 0.2 L-0.45 0.5 Z', transform: `rotate(${-ORIENTATION_DEG[terrain.orientation]})` }),
      s('text', { class: 'site-text', y: 1.3, 'text-anchor': 'middle' }, 'N')),
  );
  return svg;
}
