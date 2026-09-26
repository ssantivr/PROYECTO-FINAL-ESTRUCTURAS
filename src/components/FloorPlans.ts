import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../core/appState';
import { drawPlanSheet } from '../render/planDrawing';
import { downloadFile, serializeSvg } from '../services/persistence';

type PlanMode = 'ground' | 'upper' | 'both';

export class FloorPlans extends Component {
  private mode: PlanMode = 'both';
  private readonly canvas = h('div', { class: 'plan-canvas' });
  private readonly readout = h('span', { class: 'plan-readout' }, 'Pase el cursor sobre un espacio para ver sus datos');
  private readonly segments = new Map<PlanMode, HTMLButtonElement>();

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'plans' }));
    const seg = h('div', { class: 'segmented' });
    for (const [mode, label] of [['ground', 'Planta Baja'], ['upper', 'Planta Alta'], ['both', 'Ambas']] as const) {
      const btn = h('button', { class: 'seg', type: 'button', onclick: () => this.setMode(mode) }, label);
      this.segments.set(mode, btn);
      seg.append(btn);
    }
    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Planos 2D'),
        seg,
        h('button', { class: 'icon-btn', type: 'button', title: 'Descargar plano', 'aria-label': 'Descargar plano', onclick: () => this.download() }, icon('download', 16)),
      ),
      this.canvas,
      h('footer', { class: 'panel-foot' }, this.readout),
    );
    this.canvas.addEventListener('pointerover', (e) => this.inspect(e.target));
    this.canvas.addEventListener('pointerleave', () => this.inspect(null));
    this.setMode('both');
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private floors() {
    const floors = this.store.get().project.building.floors;
    if (this.mode === 'ground') return floors.slice(0, 1);
    if (this.mode === 'upper') return floors.slice(1, 2);
    return floors;
  }

  private setMode(mode: PlanMode): void {
    this.mode = mode;
    this.segments.forEach((btn, key) => btn.setAttribute('aria-pressed', String(key === mode)));
    this.render();
  }

  private render(): void {
    this.canvas.replaceChildren(drawPlanSheet(this.floors()));
  }

  private inspect(target: EventTarget | null): void {
    this.canvas.querySelectorAll('.room.is-hover').forEach((el) => el.classList.remove('is-hover'));
    const id = target instanceof SVGElement ? target.dataset['room'] : undefined;
    const room = id ? this.store.get().project.building.floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floor: f.name }))).find((r) => r.id === id) : undefined;
    if (!room || !(target instanceof SVGElement)) {
      this.readout.textContent = 'Pase el cursor sobre un espacio para ver sus datos';
      return;
    }
    target.classList.add('is-hover');
    this.readout.textContent = `${room.floor} · ${room.name}: ${formatNumber(room.width, 2)} × ${formatNumber(room.depth, 2)} m = ${formatNumber(room.width * room.depth, 2)} m²`;
  }

  private download(): void {
    const svg = this.canvas.querySelector('svg');
    if (!svg) return;
    const name = this.store.get().project.name;
    downloadFile(`${name.replace(/\s+/g, '_')}_planos_${this.mode}.svg`, serializeSvg(svg, name), 'image/svg+xml');
  }
}
