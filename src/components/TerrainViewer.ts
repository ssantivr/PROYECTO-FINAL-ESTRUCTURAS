import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { TerrainLayerId } from '../types/ui';
import { SLOPE_CLASSES, TERRAIN_LAYERS } from '../data/terrainLayers';
import { contourIntervalFor, drawTerrainLayers } from '../render/terrainLayers';
import { elevationAt, MONTHS } from '../services/terrainAnalysis';
import { elevationRange, reliefClass, slopeAt } from '../services/terrainInsights';
import { downloadFile, serializeSvg } from '../services/persistence';

export class TerrainViewer extends Component {
  private readonly layers = new Set<TerrainLayerId>(TERRAIN_LAYERS.filter((l) => l.defaultOn).map((l) => l.id));
  private readonly stage = h('div', { class: 'tv-stage' });
  private readonly readout = h('span', { class: 'plan-readout' }, 'Pase el cursor sobre el lote para leer cota y pendiente');
  private readonly stats = h('div', { class: 'tv-stats' });
  private readonly legend = h('div', { class: 'tv-legend' });
  private svg: SVGSVGElement | null = null;

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel terrain-viewer', 'data-area': 'terrainViewer' }));
    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Visor del terreno'),
        h('span', { class: 'badge' }, 'Capas'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => this.download() }, icon('download', 14), 'SVG')),
      h('div', { class: 'tv-body' },
        h('div', { class: 'tv-main' }, this.stage, this.legend),
        h('aside', { class: 'tv-side' },
          h('h3', { class: 'sub-title' }, 'Capas'),
          h('div', { class: 'tv-layers', role: 'group', 'aria-label': 'Capas del terreno' }, ...TERRAIN_LAYERS.map((layer) => this.layerToggle(layer.id, layer.label, layer.swatch))),
          this.stats)),
      h('footer', { class: 'panel-foot' }, this.readout),
    );
    this.stage.addEventListener('pointermove', (e) => this.inspect(e));
    this.stage.addEventListener('pointerleave', () => (this.readout.textContent = 'Pase el cursor sobre el lote para leer cota y pendiente'));
    this.render();
    this.track(store.subscribe((st, prev) => {
      if (st.project.terrain !== prev.project.terrain || st.project.building !== prev.project.building || st.sunMonth !== prev.sunMonth || st.sunHour !== prev.sunHour) this.render();
    }));
  }

  private layerToggle(id: TerrainLayerId, label: string, swatch: string): HTMLLabelElement {
    const input = h('input', { type: 'checkbox', checked: this.layers.has(id) });
    input.addEventListener('change', () => {
      if (input.checked) this.layers.add(id);
      else this.layers.delete(id);
      this.render();
    });
    return h('label', { class: 'tv-layer-toggle' }, input, h('i', { style: `background:${swatch}` }), h('span', {}, label));
  }

  private render(): void {
    const { project, sunMonth, sunHour } = this.store.get();
    const { terrain } = project;
    const interval = contourIntervalFor(terrain);
    this.svg = drawTerrainLayers(project, { layers: this.layers, sunMonth, sunHour, contourInterval: interval });
    this.stage.replaceChildren(this.svg);

    const range = elevationRange(terrain);
    const relief = reliefClass(terrain.slopePercent);
    this.stats.replaceChildren(
      h('h3', { class: 'sub-title' }, 'Lectura'),
      h('dl', { class: 'data-list' },
        ...pair('Relieve', relief.label),
        ...pair('Cota mínima', `${formatNumber(range.min, 1)} m`),
        ...pair('Cota máxima', `${formatNumber(range.max, 1)} m`),
        ...pair('Desnivel', `${formatNumber(range.drop, 2)} m`),
        ...pair('Curvas', `cada ${formatNumber(interval, 2)} m`),
        ...pair('Sol', `${MONTHS[sunMonth] ?? ''} · ${Math.floor(sunHour)}:${sunHour % 1 ? '30' : '00'}`)),
      h('p', { class: `tv-note tone-${relief.tone}` }, relief.note),
    );

    const legendItems: HTMLElement[] = [];
    if (this.layers.has('slope')) legendItems.push(...SLOPE_CLASSES.map((c) => h('span', { class: 'topo-key' }, h('i', { style: `background:${c.color}` }), c.label)));
    else if (this.layers.has('elevation')) legendItems.push(h('span', { class: 'tv-gradient' }), h('span', {}, `${formatNumber(range.min, 1)} – ${formatNumber(range.max, 1)} m s. n. m.`));
    this.legend.replaceChildren(...legendItems);
  }

  private inspect(e: PointerEvent): void {
    const svg = this.svg;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    const { terrain } = this.store.get().project;
    if (point.x < 0 || point.y < 0 || point.x > terrain.width || point.y > terrain.length) {
      this.readout.textContent = 'Fuera del lote';
      return;
    }
    const cota = terrain.elevation + elevationAt(terrain, point.x, point.y);
    this.readout.textContent = `x ${formatNumber(point.x, 1)} m · y ${formatNumber(point.y, 1)} m · cota ${formatNumber(cota, 2)} m s. n. m. · pendiente local ${formatNumber(slopeAt(terrain, point.x, point.y), 1)} %`;
  }

  private download(): void {
    if (!this.svg) return;
    const name = this.store.get().project.name;
    downloadFile(`${name.replace(/\s+/g, '_')}_terreno.svg`, serializeSvg(this.svg, name), 'image/svg+xml');
  }
}

function pair(label: string, value: string): HTMLElement[] {
  return [h('dt', {}, label), h('dd', {}, value)];
}
