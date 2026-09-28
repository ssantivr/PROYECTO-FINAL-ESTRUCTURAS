import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import { drawPlanSheet } from '../render/planDrawing';
import { drawSitePlan } from '../render/sitePlan';
import { downloadFile, serializeSvg } from '../services/persistence';
import { exportPdf } from '../services/pdfExport';
import { api, describeApiError } from '../services/apiClient';

type PlanMode = 'ground' | 'upper' | 'all' | 'site';

const MODES: ReadonlyArray<[PlanMode, string]> = [
  ['ground', 'Planta baja'],
  ['upper', 'Planta alta'],
  ['all', 'Todas'],
  ['site', 'Implantación'],
];

export interface FloorPlansActions {
  saveFirst: () => Promise<boolean>;
  notify: (message: string, kind: 'info' | 'success' | 'error') => void;
}

export class FloorPlans extends Component {
  private mode: PlanMode = 'ground';
  private readonly canvas = h('div', { class: 'plan-canvas' });
  private readonly readout = h('span', { class: 'plan-readout' }, 'Pase el cursor sobre un espacio para ver sus datos');
  private readonly generated = h('span', { class: 'plan-generated' });
  private readonly segments = new Map<PlanMode, HTMLButtonElement>();

  constructor(private readonly store: AppStore, private readonly actions: FloorPlansActions) {
    super(h('section', { class: 'panel', 'data-area': 'plans' }));
    const seg = h('div', { class: 'segmented', role: 'tablist' });
    for (const [mode, label] of MODES) {
      const btn = h('button', { class: 'seg', type: 'button', role: 'tab', onclick: () => this.setMode(mode) }, label);
      this.segments.set(mode, btn);
      seg.append(btn);
    }
    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Planos'),
        seg,
        h('div', { class: 'head-actions' },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => void this.generate() }, icon('rotate', 14), 'Generar planos'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => this.download() }, icon('download', 14), 'Descargar plano'),
          h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => this.pdf() }, icon('download', 14), 'Exportar PDF')),
      ),
      this.canvas,
      h('footer', { class: 'panel-foot' }, this.readout, this.generated),
    );
    this.canvas.addEventListener('pointerover', (e) => this.inspect(e.target));
    this.canvas.addEventListener('pointerleave', () => this.inspect(null));
    this.setMode('ground');
    this.track(store.select((st) => st.project, () => this.render()));
    this.track(store.select((st) => st.project.id, () => void this.loadGenerated()));
    void this.loadGenerated();
  }

  private setMode(mode: PlanMode): void {
    this.mode = mode;
    this.segments.forEach((btn, key) => btn.setAttribute('aria-selected', String(key === mode)));
    this.render();
  }

  private render(): void {
    const { project } = this.store.get();
    const floors = project.building.floors;
    if (this.mode === 'site') {
      this.canvas.replaceChildren(drawSitePlan(project));
      return;
    }
    if (this.mode === 'upper' && floors.length < 2) {
      this.canvas.replaceChildren(h('p', { class: 'empty-state' }, 'El proyecto tiene un solo piso. Aumente el número de pisos en Construcción y genere la distribución.'));
      return;
    }
    const shown = this.mode === 'ground' ? floors.slice(0, 1) : this.mode === 'upper' ? floors.slice(1) : floors;
    this.canvas.replaceChildren(drawPlanSheet(shown));
  }

  private async loadGenerated(): Promise<void> {
    const { mode, project } = this.store.get();
    if (mode !== 'server' || project.id.startsWith('local-')) {
      this.generated.textContent = 'Sin conexión: los planos se generan en el navegador';
      return;
    }
    try {
      const plans = await api.listFloorPlans(project.id);
      const last = plans.at(-1);
      this.generated.textContent = last
        ? `${plans.length} planos guardados · ${new Date(last.createdAt).toLocaleString('es-CO')}`
        : 'Aún no se han guardado planos en el servidor';
    } catch {
      this.generated.textContent = '';
    }
  }

  private async generate(): Promise<void> {
    const { mode } = this.store.get();
    if (mode !== 'server') {
      this.render();
      this.actions.notify('Planos regenerados localmente a partir de los datos del proyecto.', 'info');
      return;
    }
    if (!(await this.actions.saveFirst())) return;
    try {
      const plans = await api.generateFloorPlans(this.store.get().project.id);
      this.render();
      this.actions.notify(`Se generaron y guardaron ${plans.length} planos preliminares (plantas, implantación, fachadas y corte).`, 'success');
      void this.loadGenerated();
    } catch (error) {
      this.actions.notify(describeApiError(error, 'No fue posible generar los planos.'), 'error');
    }
  }

  private inspect(target: EventTarget | null): void {
    this.canvas.querySelectorAll('.room.is-hover').forEach((el) => el.classList.remove('is-hover'));
    const id = target instanceof SVGElement ? target.dataset['room'] : undefined;
    const floorEl = target instanceof SVGElement ? target.closest('[data-floor]') : null;
    const floor = this.store.get().project.building.floors.find((f) => f.id === (floorEl as SVGElement | null)?.dataset['floor']);
    const room = floor?.rooms.find((r) => r.id === id);
    if (!room || !floor || !(target instanceof SVGElement)) {
      this.readout.textContent = 'Pase el cursor sobre un espacio para ver sus datos';
      return;
    }
    target.classList.add('is-hover');
    this.readout.textContent = `${floor.name} · ${room.name}: ${formatNumber(room.width, 2)} × ${formatNumber(room.depth, 2)} m = ${formatNumber(room.width * room.depth, 2)} m²`;
  }

  private download(): void {
    const svg = this.canvas.querySelector('svg');
    if (!svg) return;
    const name = this.store.get().project.name;
    downloadFile(`${name.replace(/\s+/g, '_')}_${this.mode}.svg`, serializeSvg(svg, name), 'image/svg+xml');
  }

  private pdf(): void {
    if (!exportPdf(this.store.get().project)) {
      this.actions.notify('El navegador bloqueó la ventana de impresión; permita ventanas emergentes para exportar el PDF.', 'error');
    }
  }
}
